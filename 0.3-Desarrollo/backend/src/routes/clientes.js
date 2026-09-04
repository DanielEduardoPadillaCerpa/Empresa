const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { cifrar, descifrar } = require('../crypto');
const { requiereAutenticacion, requiereAdmin } = require('./auth');
const { registrarAuditoria } = require('../auditoria');

// GET /api/clientes -> lista todos los clientes (descifrados)
router.get('/', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT * FROM clientes ORDER BY fecha_registro DESC');
    const clientes = filas.map(c => ({
      id: c.id,
      nombreUnidad: c.nombre_unidad,
      direccionInstalacion: c.direccion_instalacion,
      nit: c.nit,
      nombreFuncionario: descifrar(c.nombre_funcionario),
      correo: descifrar(c.correo),
      telefono: descifrar(c.telefono),
      direccionEntrega: descifrar(c.direccion_entrega),
      autorizacionGeneral: !!c.autorizacion_general,
      fechaRegistro: c.fecha_registro,
    }));
    res.json(clientes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando clientes' });
  }
});

// GET /api/clientes/:id
router.get('/:id', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    if (!filas.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    const c = filas[0];
    res.json({
      id: c.id,
      nombreUnidad: c.nombre_unidad,
      direccionInstalacion: c.direccion_instalacion,
      nit: c.nit,
      nombreFuncionario: descifrar(c.nombre_funcionario),
      correo: descifrar(c.correo),
      telefono: descifrar(c.telefono),
      direccionEntrega: descifrar(c.direccion_entrega),
      autorizacionGeneral: !!c.autorizacion_general,
      fechaRegistro: c.fecha_registro,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando cliente' });
  }
});

// POST /api/clientes -> registra un nuevo cliente
router.post('/', async (req, res) => {
  try {
    const {
      nombreUnidad, direccionInstalacion, nit,
      nombreFuncionario, correo, telefono, direccionEntrega,
      autorizacionGeneral
    } = req.body;

    if (!nombreUnidad || !nit || !nombreFuncionario || !correo) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const [resultado] = await pool.query(
      `INSERT INTO clientes
        (nombre_unidad, direccion_instalacion, nit, nombre_funcionario, correo, telefono, direccion_entrega, autorizacion_general)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombreUnidad,
        direccionInstalacion,
        nit,
        cifrar(nombreFuncionario),
        cifrar(correo),
        cifrar(telefono),
        cifrar(direccionEntrega),
        !!autorizacionGeneral,
      ]
    );

    await registrarAuditoria({
      usuario: req.usuario, // puede ser undefined si el registro es público (autoregistro)
      accion: 'crear',
      entidad: 'cliente',
      entidadId: resultado.insertId,
      detalle: { nombreUnidad, nit },
    });

    res.status(201).json({ id: resultado.insertId, nombreUnidad, nit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error registrando cliente' });
  }
});

// PUT /api/clientes/:id -> editar cliente (solo admin) — usado por admin-clientes.html
router.put('/:id', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const { nombreUnidad, nit, nombreFuncionario, correo, telefono, direccionInstalacion, direccionEntrega } = req.body;

    const [existente] = await pool.query('SELECT id FROM clientes WHERE id = ?', [req.params.id]);
    if (!existente.length) return res.status(404).json({ error: 'Cliente no encontrado' });

    await pool.query(
      `UPDATE clientes SET
         nombre_unidad = ?,
         nit = ?,
         nombre_funcionario = ?,
         correo = ?,
         telefono = ?,
         direccion_instalacion = COALESCE(?, direccion_instalacion),
         direccion_entrega = COALESCE(?, direccion_entrega)
       WHERE id = ?`,
      [
        nombreUnidad,
        nit,
        cifrar(nombreFuncionario),
        cifrar(correo),
        cifrar(telefono),
        direccionInstalacion || null,
        direccionEntrega ? cifrar(direccionEntrega) : null,
        req.params.id,
      ]
    );

    await registrarAuditoria({
      usuario: req.usuario,
      accion: 'editar',
      entidad: 'cliente',
      entidadId: req.params.id,
      detalle: { nombreUnidad, nit },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualizando cliente' });
  }
});

// DELETE /api/clientes/:id -> eliminar cliente (solo admin) — usado por admin-clientes.html
router.delete('/:id', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const [existente] = await pool.query('SELECT id FROM clientes WHERE id = ?', [req.params.id]);
    if (!existente.length) return res.status(404).json({ error: 'Cliente no encontrado' });

    await pool.query('DELETE FROM clientes WHERE id = ?', [req.params.id]);

    await registrarAuditoria({
      usuario: req.usuario,
      accion: 'eliminar',
      entidad: 'cliente',
      entidadId: req.params.id,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando cliente' });
  }
});

// POST /api/clientes/:id/dato-sensible -> registra antecedentes judiciales con consentimiento separado
router.post('/:id/dato-sensible', async (req, res) => {
  try {
    const { numeroConsultaAntecedentes, autorizacionSensible } = req.body;

    if (!autorizacionSensible) {
      return res.status(400).json({ error: 'No se puede guardar un dato sensible sin autorización expresa' });
    }

    const [cliente] = await pool.query('SELECT id FROM clientes WHERE id = ?', [req.params.id]);
    if (!cliente.length) return res.status(404).json({ error: 'Cliente no encontrado' });

    const [resultado] = await pool.query(
      `INSERT INTO datos_sensibles (cliente_id, numero_consulta_antecedentes, autorizacion_sensible)
       VALUES (?, ?, ?)`,
      [req.params.id, cifrar(numeroConsultaAntecedentes), true]
    );

    res.status(201).json({ id: resultado.insertId, clienteId: Number(req.params.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error registrando dato sensible' });
  }
});

module.exports = router;
