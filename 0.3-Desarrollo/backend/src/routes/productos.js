const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const { pool } = require('../db');
const { requiereAutenticacion, requiereAdmin } = require('./auth');
const { registrarAuditoria } = require('../auditoria');

// Umbral por defecto para considerar "inventario bajo" (configurable por .env)
const STOCK_MINIMO = Number(process.env.STOCK_MINIMO || 10);

const IMAGENES_DIR = path.join(__dirname, '../../img/productos');
const TIPOS_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
async function leerMultipart(req) {
  if (!String(req.headers['content-type'] || '').startsWith('multipart/form-data')) return;
  const match = req.headers['content-type'].match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) throw Object.assign(new Error('Formulario multipart invalido'), { status: 400 });
  const chunks = []; let total = 0;
  for await (const chunk of req) { total += chunk.length; if (total > 6 * 1024 * 1024) throw Object.assign(new Error('Archivo demasiado grande'), { status: 413 }); chunks.push(chunk); }
  const body = Buffer.concat(chunks); const boundary = Buffer.from('--' + (match[1] || match[2]));
  const campos = {}; let archivo = null;
  for (const parte of splitBuffer(body, boundary).slice(1)) {
    const fin = parte.indexOf(Buffer.from('\r\n\r\n')); if (fin < 0) continue;
    const cabeceras = parte.subarray(0, fin).toString('utf8');
    let contenido = parte.subarray(fin + 4); if (contenido.subarray(-2).toString() === '\r\n') contenido = contenido.subarray(0, -2);
    const nombre = (cabeceras.match(/name="([^"]+)"/) || [])[1]; if (!nombre) continue;
    const nombreArchivo = (cabeceras.match(/filename="([^"]*)"/) || [])[1];
    if (!nombreArchivo) { campos[nombre] = contenido.toString('utf8'); continue; }
    const tipo = (cabeceras.match(/Content-Type:\s*([^\r\n]+)/i) || [])[1] || '';
    if (!TIPOS_IMAGEN.has(tipo) || contenido.length > 5 * 1024 * 1024) throw Object.assign(new Error('Imagen no valida. Usa JPG, PNG, WEBP o GIF de maximo 5 MB.'), { status: 400 });
    await fs.promises.mkdir(IMAGENES_DIR, { recursive: true });
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[tipo];
    const nombreSeguro = crypto.randomBytes(12).toString('hex') + ext;
    await fs.promises.writeFile(path.join(IMAGENES_DIR, nombreSeguro), contenido);
    archivo = '/img/productos/' + nombreSeguro;
  }
  req.body = campos; if (archivo) req.fileImagePath = archivo;
}
function splitBuffer(buffer, separator) {
  const partes = []; let inicio = 0; let posicion;
  while ((posicion = buffer.indexOf(separator, inicio)) !== -1) { partes.push(buffer.subarray(inicio, posicion)); inicio = posicion + separator.length; }
  partes.push(buffer.subarray(inicio)); return partes;
}
function incluirInactivosSiAdmin(req, res, next) {
  if (req.query.incluir_inactivos !== '1') return next();
  return requiereAutenticacion(req, res, () => requiereAdmin(req, res, next));
}


// GET /api/productos -> catálogo público (solo productos activos)
// Admite ?categoria_id= para filtrar y ?incluir_inactivos=1 (solo admin) para gestión.
router.get('/', incluirInactivosSiAdmin, async (req, res) => {
  try {
    const categoriaId = req.query.categoria_id;
    const incluirInactivos = req.query.incluir_inactivos === '1';

    let sql = `
      SELECT id, nombre, descripcion, precio, imagen, cantidad_disponible, estado, restringido, categoria_id, macrocategoria, metadatos, fecha_creacion
      FROM productos
    `;
    const condiciones = [];
    const params = [];

    if (!incluirInactivos) {
      condiciones.push("estado = 'activo'");
    }
    if (categoriaId) {
      condiciones.push('categoria_id = ?');
      params.push(categoriaId);
    }
    if (condiciones.length) {
      sql += ' WHERE ' + condiciones.join(' AND ');
    }
    sql += ' ORDER BY nombre ASC';

    const [filas] = await pool.query(sql, params);
    res.json(filas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error cargando productos' });
  }
});

// GET /api/productos/bajo-inventario -> productos por debajo del umbral mínimo (solo admin)
// IMPORTANTE: declarada ANTES de '/:id', porque Express prueba las rutas en
// orden y '/:id' interpretaría "bajo-inventario" como si fuera un ID.
router.get('/bajo-inventario', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const umbral = req.query.umbral ? Number(req.query.umbral) : STOCK_MINIMO;
    const [filas] = await pool.query(
      `SELECT id, nombre, cantidad_disponible, categoria_id
       FROM productos
       WHERE estado = 'activo' AND cantidad_disponible <= ?
       ORDER BY cantidad_disponible ASC`,
      [umbral]
    );
    res.json({ umbral, productos: filas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando inventario bajo' });
  }
});

// GET /api/productos/:id -> detalle de un producto (público — página tipo "detalle de producto")
router.get('/:id', async (req, res) => {
  try {
    const [filas] = await pool.query(
      `SELECT id, nombre, descripcion, precio, imagen, cantidad_disponible, estado, restringido, categoria_id, macrocategoria, metadatos, fecha_creacion
       FROM productos WHERE id = ?`,
      [req.params.id]
    );
    if (!filas.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(filas[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando producto' });
  }
});

// POST /api/productos -> crear producto (solo admin)
router.post('/', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try { await leerMultipart(req); } catch (err) { return res.status(err.status || 400).json({ error: err.message }); }
  try {
    const { nombre, descripcion, precio, imagen: imagenRecibida, cantidad_disponible, estado, restringido, categoria_id, macrocategoria, metadatos } = req.body;
    const imagen = req.fileImagePath || imagenRecibida;

    if (!nombre || precio === undefined || precio === null) {
      return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
    }

    let metadatosObjeto = metadatos;
    if (typeof metadatos === 'string') { try { metadatosObjeto = JSON.parse(metadatos); } catch (err) { metadatosObjeto = null; } }
    const metadatosJson = metadatosObjeto && typeof metadatosObjeto === 'object' ? JSON.stringify(metadatosObjeto) : null;

    const [resultado] = await pool.query(
      `INSERT INTO productos (nombre, descripcion, precio, imagen, cantidad_disponible, estado, restringido, categoria_id, macrocategoria, metadatos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        descripcion || null,
        Number(precio),
        imagen || null,
        Number(cantidad_disponible) || 0,
        estado === 'inactivo' ? 'inactivo' : 'activo',
        !!restringido,
        categoria_id || null,
        ['vestimenta', 'herramientas'].includes(macrocategoria) ? macrocategoria : 'general',
        metadatosJson,
      ]
    );

    await registrarAuditoria({
      usuario: req.usuario,
      accion: 'crear',
      entidad: 'producto',
      entidadId: resultado.insertId,
      detalle: { nombre, precio },
    });

    res.status(201).json({ id: resultado.insertId, nombre });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando producto' });
  }
});

// PUT /api/productos/:id -> editar producto (solo admin)
router.put('/:id', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try { await leerMultipart(req); } catch (err) { return res.status(err.status || 400).json({ error: err.message }); }
  try {
    const { nombre, descripcion, precio, imagen: imagenRecibida, cantidad_disponible, estado, restringido, categoria_id, macrocategoria, metadatos } = req.body;
    const imagen = req.fileImagePath || imagenRecibida;

    const [existente] = await pool.query('SELECT id FROM productos WHERE id = ?', [req.params.id]);
    if (!existente.length) return res.status(404).json({ error: 'Producto no encontrado' });

    let metadatosObjeto = metadatos;
    if (typeof metadatos === 'string') { try { metadatosObjeto = JSON.parse(metadatos); } catch (err) { metadatosObjeto = null; } }
    const metadatosJson = metadatosObjeto && typeof metadatosObjeto === 'object' ? JSON.stringify(metadatosObjeto) : null;

    await pool.query(
      `UPDATE productos SET
         nombre = ?,
         descripcion = ?,
         precio = ?,
         imagen = COALESCE(?, imagen),
         cantidad_disponible = ?,
         estado = ?,
         restringido = ?,
         categoria_id = ?,
         macrocategoria = ?,
         metadatos = ?
       WHERE id = ?`,
      [
        nombre,
        descripcion || null,
        Number(precio),
        imagen || null,
        Number(cantidad_disponible) || 0,
        estado === 'inactivo' ? 'inactivo' : 'activo',
        !!restringido,
        categoria_id || null,
        ['vestimenta', 'herramientas'].includes(macrocategoria) ? macrocategoria : 'general',
        metadatosJson,
        req.params.id,
      ]
    );

    await registrarAuditoria({
      usuario: req.usuario,
      accion: 'editar',
      entidad: 'producto',
      entidadId: req.params.id,
      detalle: { nombre, precio, cantidad_disponible },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualizando producto' });
  }
});

// DELETE /api/productos/:id -> eliminar producto (solo admin)
// Si el producto ya tiene pedidos asociados (detalle_pedido), no se puede
// borrar sin romper el historial de compras: en ese caso se desactiva
// (estado = 'inactivo') en vez de eliminarlo físicamente, y se informa al
// admin por qué. Si nunca se vendió, se elimina de verdad.
router.delete('/:id', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const [existente] = await pool.query('SELECT id, nombre FROM productos WHERE id = ?', [req.params.id]);
    if (!existente.length) return res.status(404).json({ error: 'Producto no encontrado' });

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM detalle_pedido WHERE producto_id = ?',
      [req.params.id]
    );

    if (total > 0) {
      await pool.query("UPDATE productos SET estado = 'inactivo' WHERE id = ?", [req.params.id]);
      await registrarAuditoria({
        usuario: req.usuario,
        accion: 'editar',
        entidad: 'producto',
        entidadId: req.params.id,
        detalle: { motivo: 'desactivado en vez de eliminado (tiene pedidos asociados)' },
      });
      return res.json({ ok: true, desactivado: true, mensaje: 'El producto tiene pedidos asociados: se desactivó del catálogo en vez de eliminarse, para no romper el historial.' });
    }

    await pool.query('DELETE FROM productos WHERE id = ?', [req.params.id]);
    await registrarAuditoria({
      usuario: req.usuario,
      accion: 'eliminar',
      entidad: 'producto',
      entidadId: req.params.id,
      detalle: { nombre: existente[0].nombre },
    });
    res.json({ ok: true, desactivado: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando producto' });
  }
});

module.exports = router;
