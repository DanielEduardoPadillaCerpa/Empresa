const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { cifrar } = require('../crypto');
const { requiereAutenticacion } = require('./auth');
const { getPaymentProvider } = require('../paymentProviderInstance');
const { invalidarIndiceCatalogo } = require('../assistant/indiceCatalogo');

const CAMPOS_COMPRADOR = new Set([
  'tipo',
  'nombre',
  'identificacion',
  'razonSocial',
  'nit',
  'nombreComprador',
  'telefono',
  'correo'
]);

function parsearIdentificador(valor) {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

function precioACentavos(valor) {
  const coincidencia = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(valor));
  if (!coincidencia) throw new Error('El precio almacenado tiene un formato inválido.');
  return BigInt(coincidencia[1]) * 100n + BigInt((coincidencia[2] || '').padEnd(2, '0') || '0');
}

function centavosAPrecio(valor) {
  const centavos = BigInt(valor);
  const unidad = centavos / 100n;
  const fraccion = String(centavos % 100n).padStart(2, '0');
  return `${unidad}.${fraccion}`;
}

function datosCompradorSeguros(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null;
  const salida = {};
  for (const [campo, valor] of Object.entries(datos)) {
    if (!CAMPOS_COMPRADOR.has(campo) || typeof valor !== 'string' || valor.length > 255) return null;
    salida[campo] = valor.trim();
  }
  if (salida.tipo === 'persona_natural') {
    return salida.nombre && salida.identificacion ? salida : null;
  }
  if (salida.tipo === 'empresa') {
    return salida.razonSocial && salida.nit ? salida : null;
  }
  return null;
}

function contieneDatosTarjeta(valor) {
  if (!valor || typeof valor !== 'object') return false;
  if (Array.isArray(valor)) return valor.some(contieneDatosTarjeta);
  return Object.entries(valor).some(([clave, contenido]) =>
    /(?:card.?number|numero.?tarjeta|pan|cvv|cvc|security.?code|tarjeta.?titular)/i.test(clave)
    || contieneDatosTarjeta(contenido)
  );
}

function hashSolicitud({ items, enviarComprobante, metodo }) {
  return crypto.createHash('sha256')
    .update(JSON.stringify({ items, enviarComprobante, metodo }))
    .digest('hex');
}

function respuestaCheckout(pago) {
  return {
    pedido_id: Number(pago.pedido_id),
    estado: pago.estado,
    proveedor: pago.proveedor,
    widget_token: pago.widget_token,
    widget_url: pago.widget_url,
    expira_en: pago.expira_en
  };
}

async function buscarPagoPorIdempotencia(idempotencyKey, clienteId, requestHash) {
  const [filas] = await pool.query(
    `SELECT p.pedido_id, p.proveedor, p.request_hash, p.widget_token,
            p.widget_url, p.estado, p.expira_en, o.cliente_id
     FROM pagos p
     JOIN pedidos o ON o.id = p.pedido_id
     WHERE p.idempotency_key = ?`,
    [idempotencyKey]
  );
  if (!filas.length) return null;
  const pago = filas[0];
  if (Number(pago.cliente_id) !== Number(clienteId) || pago.request_hash !== requestHash) {
    const error = new Error('La clave de idempotencia ya fue utilizada para otra solicitud.');
    error.status = 409;
    throw error;
  }
  return respuestaCheckout(pago);
}

router.post('/', requiereAutenticacion, async (req, res) => {
  let connection;
  let clienteId;
  let idempotencyKey;
  let requestHash;
  try {
    clienteId = parsearIdentificador(req.usuario?.clienteId);
    if (!clienteId) return res.status(403).json({ error: 'La cuenta no está habilitada para realizar compras.' });

    idempotencyKey = String(req.get('Idempotency-Key') || '');
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) {
      return res.status(400).json({ error: 'Falta una clave de idempotencia válida.' });
    }
    if (contieneDatosTarjeta(req.body)) {
      return res.status(400).json({ error: 'Los datos de tarjeta deben ingresarse únicamente en la pasarela de pago.' });
    }

    const { items, enviarComprobante = false, datosComprador, direccionEntrega, metodo = 'mock' } = req.body || {};
    if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
      return res.status(400).json({ error: 'El carrito no contiene artículos válidos.' });
    }
    if (typeof enviarComprobante !== 'boolean' || typeof direccionEntrega !== 'string' ||
        direccionEntrega.trim().length < 3 || direccionEntrega.length > 1000) {
      return res.status(400).json({ error: 'Los datos de compra no son válidos.' });
    }
    if (typeof metodo !== 'string' || !/^[a-zA-Z0-9_-]{1,32}$/.test(metodo)) {
      return res.status(400).json({ error: 'El método de pago no es válido.' });
    }
    const comprador = datosCompradorSeguros(datosComprador);
    if (!comprador) return res.status(400).json({ error: 'Los datos del comprador no son válidos.' });
    if (typeof req.usuario?.correo === 'string') comprador.correo = req.usuario.correo;

    const cantidadesPorProducto = new Map();
    const lineas = [];
    for (const item of items) {
      const id = parsearIdentificador(item?.id);
      const cantidad = Number(item?.cantidad);
      if (!id || !Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 500 ||
          (item?.variacion !== undefined && (typeof item.variacion !== 'string' || item.variacion.length > 80))) {
        return res.status(400).json({ error: 'Uno o más artículos del carrito no son válidos.' });
      }
      cantidadesPorProducto.set(id, (cantidadesPorProducto.get(id) || 0) + cantidad);
      lineas.push({ id, cantidad, variacion: item.variacion?.trim() || null });
    }

    requestHash = hashSolicitud({ items: lineas, enviarComprobante, metodo });
    const existente = await buscarPagoPorIdempotencia(idempotencyKey, clienteId, requestHash);
    if (existente) return res.status(200).json(existente);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [revisado] = await connection.query(
      `SELECT p.pedido_id, p.request_hash, p.widget_token, p.widget_url,
              p.estado, p.proveedor, p.expira_en, o.cliente_id
       FROM pagos p JOIN pedidos o ON o.id = p.pedido_id
       WHERE p.idempotency_key = ? FOR UPDATE`,
      [idempotencyKey]
    );
    if (revisado.length) {
      await connection.rollback();
      if (Number(revisado[0].cliente_id) !== clienteId || revisado[0].request_hash !== requestHash) {
        return res.status(409).json({ error: 'La clave de idempotencia ya fue utilizada para otra solicitud.' });
      }
      return res.status(200).json(respuestaCheckout(revisado[0]));
    }

    const [clientes] = await connection.query(
      'SELECT autorizacion_general FROM clientes WHERE id = ? FOR UPDATE',
      [clienteId]
    );
    if (!clientes.length) {
      await connection.rollback();
      return res.status(403).json({ error: 'La cuenta no está vinculada a un cliente habilitado para comprar.' });
    }

    const idsOrdenados = [...cantidadesPorProducto.keys()].sort((a, b) => a - b);
    const productosPorId = new Map();
    let totalCentavos = 0n;
    let hayRestringido = false;
    for (const id of idsOrdenados) {
      const [filas] = await connection.query(
        `SELECT id, nombre, precio, cantidad_disponible, restringido, estado
         FROM productos WHERE id = ? FOR UPDATE`,
        [id]
      );
      const producto = filas[0];
      if (!producto || producto.estado !== 'activo') {
        await connection.rollback();
        return res.status(409).json({ error: 'Uno o más productos ya no están disponibles.' });
      }
      if (cantidadesPorProducto.get(id) > Number(producto.cantidad_disponible)) {
        await connection.rollback();
        return res.status(409).json({ error: 'No hay inventario suficiente para completar la compra.' });
      }
      producto.precioCentavos = precioACentavos(producto.precio);
      totalCentavos += producto.precioCentavos * BigInt(cantidadesPorProducto.get(id));
      productosPorId.set(id, producto);
      hayRestringido = hayRestringido || Boolean(producto.restringido);
    }

    if (hayRestringido && !clientes[0].autorizacion_general) {
      await connection.rollback();
      return res.status(403).json({ error: 'El pedido requiere autorización previa para artículos restringidos.' });
    }

    const itemsCanonicos = lineas.map(linea => {
      const producto = productosPorId.get(linea.id);
      return {
        id: producto.id,
        nombre: producto.nombre,
        cantidad: linea.cantidad,
        precio: centavosAPrecio(producto.precioCentavos),
        precio_centavos: String(producto.precioCentavos),
        ...(linea.variacion ? { variacion: linea.variacion } : {})
      };
    });
    const ahora = new Date();
    const expiraEn = new Date(ahora.getTime() + 15 * 60 * 1000);
    const compradorCifrado = cifrar(JSON.stringify(comprador));
    const direccionCifrada = cifrar(direccionEntrega.trim());

    const [pedidoCreado] = await connection.query(
      `INSERT INTO pedidos
        (cliente_id, items, total, estado, datos_comprador_cifrados, direccion_entrega_cifrada, enviar_comprobante)
       VALUES (?, ?, ?, 'pendiente_pago', ?, ?, ?)`,
      [
        clienteId,
        JSON.stringify(itemsCanonicos),
        centavosAPrecio(totalCentavos),
        compradorCifrado,
        direccionCifrada,
        enviarComprobante
      ]
    );

    const proveedor = getPaymentProvider();
    const intento = await proveedor.crearIntento({ montoCentavos: totalCentavos, moneda: 'COP', expiraEn });
    for (const [id, cantidad] of cantidadesPorProducto) {
      const [reserva] = await connection.query(
        `UPDATE productos SET cantidad_disponible = cantidad_disponible - ?
         WHERE id = ? AND estado = 'activo' AND cantidad_disponible >= ?`,
        [cantidad, id, cantidad]
      );
      if (reserva.affectedRows !== 1) throw new Error('No se pudo reservar el inventario solicitado.');
    }

    await connection.query(
      `INSERT INTO pagos
        (pedido_id, proveedor, referencia_externa, idempotency_key, request_hash,
         widget_token, widget_url, estado, monto_centavos, moneda, metodo, expira_en)
       VALUES (?, 'mock', ?, ?, ?, ?, ?, 'creado', ?, 'COP', ?, ?)`,
      [
        pedidoCreado.insertId,
        intento.referenciaExterna,
        idempotencyKey,
        requestHash,
        intento.widgetToken,
        intento.widgetUrl,
        String(totalCentavos),
        metodo,
        expiraEn
      ]
    );
    await connection.commit();
    invalidarIndiceCatalogo();

    res.status(201).json({
      pedido_id: pedidoCreado.insertId,
      estado: 'creado',
      proveedor: 'mock',
      widget_token: intento.widgetToken,
      widget_url: intento.widgetUrl,
      expira_en: expiraEn.toISOString()
    });
  } catch (err) {
    if (connection) await connection.rollback();
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === 'ER_DUP_ENTRY' && requestHash && idempotencyKey && clienteId) {
      try {
        const existente = await buscarPagoPorIdempotencia(idempotencyKey, clienteId, requestHash);
        if (existente) return res.status(200).json(existente);
      } catch (idempotenciaError) {
        if (idempotenciaError.status) return res.status(idempotenciaError.status).json({ error: idempotenciaError.message });
      }
    }
    console.error('[checkout] No se pudo crear el intento de pago:', err.code || 'INTERNAL_ERROR');
    const estado = err.code === 'PAYMENT_PROVIDER_TIMEOUT' ? 503 : 500;
    res.status(estado).json({ error: 'No fue posible iniciar el pago. No se confirmó ni cobró la compra.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
