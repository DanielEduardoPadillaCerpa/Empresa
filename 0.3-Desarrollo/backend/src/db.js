const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const configuredConnectionLimit = Number(process.env.DB_CONNECTION_LIMIT);
const connectionLimit = Number.isSafeInteger(configuredConnectionLimit) && configuredConnectionLimit > 0
  ? Math.min(configuredConnectionLimit, 4)
  : 4;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit,
  connectTimeout: 20000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  idleTimeout: 60000,
});

const CATEGORIAS_SEED = [
  ['Dotación', 'Uniformes y dotación básica'],
  ['Equipo táctico', 'Equipos especializados para operaciones'],
  ['Papelería oficial', 'Material oficial de oficina'],
  ['Oficina', 'Equipos y suministros de oficina'],
  ['Uniformidad', 'Prendas técnicas y calzado'],
  ['Protección personal', 'Elementos de protección pasiva'],
  ['Tráfico y medición', 'Instrumentos de control vial'],
  ['Herramientas', 'Accesorios y herramientas tácticas'],
  ['Fundas y portas', 'Fundas y sistemas de sujeción'],
  ['Tecnología', 'Comunicaciones y registro de evidencias'],
  ['Primeros auxilios', 'IFAK y soporte vital'],
  ['Criminalística', 'Policía científica y evidencias'],
];  
const USUARIOS_SEED = [
  ['admin@empresa.com', '$2b$12$y1boqSHiF9TnjNRcAUCmMubnGqRrNSBJN1oLl1ICM2HQx0FO1KSrW', 'admin'],
];
// [id, nombre, descripcion, precio, cantidad_disponible, restringido, nombreCategoria]
const PRODUCTOS_SEED = [
  ['Uniforme operativo — tela ripstop', 'Camisa y pantalón reglamentario, resistente a abrasión, disponible en tallas S a XXL.', 186000, 50, false, 'Dotación'],
  [ 'Chaleco portaequipo modular', 'Sistema MOLLE, ajuste lateral, compatible con placas de protección estándar.', 312500, 20, true, 'Equipo táctico'],
  ['Talonario de comparendos (x50)', 'Papel numerado consecutivo, formato oficial vigente, empaque sellado.', 41900, 100, false, 'Papelería oficial'],
  ['Botas tácticas antideslizantes', 'Suela de goma reforzada, punta reforzada, tallas 36 a 45.', 228000, 40, false, 'Dotación'],
  ['Kit de sellos institucionales', 'Set de 3 sellos personalizados con escudo de la unidad, entintado automático.', 97300, 30, false, 'Oficina'],
  ['Linterna operativa recargable', '1200 lúmenes, resistente a agua IP67, montaje compatible con arma larga.', 154200, 25, true, 'Equipo táctico'],
  ['Botas tácticas policiales Gore-Tex', 'Calzado con suela antideslizante, membrana impermeable y plantilla anticlavo.', 245000, 35, false, 'Uniformidad'],
  ['Pantalón táctico de dotación', 'Tratamiento de teflón, fuelles elásticos y bolsillos de carga ocultos.', 132000, 60, false, 'Uniformidad'],
  ['Polo técnico antibacterial', 'Camiseta transpirable con propiedades antibacteriales y tratamiento ignífugo.', 78500, 80, false, 'Uniformidad'],
  [ 'Chaquetón de alta visibilidad', 'Chaleco reflectante y chaquetón impermeable homologado para control de tráfico.', 96000, 40, false, 'Uniformidad'],
  [ 'Cinturón interior/exterior de dotación', 'Sistema de doble cinturón (velcro interior y rígido exterior) para fijar el equipo.', 64000, 50, false, 'Uniformidad'],
  [ 'Chaleco balístico y anticuchillo', 'Paneles de fibras de aramida (Kevlar/Twaron) con funda lavable.', 890000, 10, true, 'Protección personal'],
  [ 'Placas balísticas traumáticas', 'Placas rígidas adicionales para absorber energía de impacto en el pecho.', 410000, 15, true, 'Protección personal'],
  [ 'Guantes anticorte y antipinchazo', 'Guantes técnicos con nivel de protección certificado (nivel 5).', 58000, 70, false, 'Protección personal'],
  [ 'Gafas tácticas de protección', 'Lentes policarbonadas resistentes a impacto de fragmentos y protección UV.', 45000, 90, false, 'Protección personal'],
  [ 'Casco de protección urbana', 'Casco ligero con visera antidisturbios y protección contra impactos.', 312000, 12, true, 'Protección personal'],
  [ 'Alcoholímetro digital evidencial', 'Dispositivo portátil de cribado y pruebas judiciales.', 680000, 8, false, 'Tráfico y medición'],
  [ 'Kit de detección de drogas (salival)', 'Análisis salival cualitativo para detección de estupefacientes.', 215000, 20, false, 'Tráfico y medición'],
  [ 'Sonómetro digital', 'Medición de contaminación acústica y decibelios de vehículos o locales.', 189000, 15, false, 'Tráfico y medición'],
  [ 'Cinemómetro láser de tránsito', 'Pistola láser de medición de velocidad vehicular.', 1250000, 5, false, 'Tráfico y medición'],
  [ 'Kit de croquis vial (cinta y odómetro)', 'Rueda de medición y cinta métrica para levantamiento de accidentes.', 76000, 25, false, 'Tráfico y medición'],
  [ 'Cono de señalización con linterna', 'Cono de polímero acoplable a linterna para dirigir tráfico nocturno.', 38500, 60, false, 'Tráfico y medición'],
  [ 'Grilletes metálicos de bisagra', 'Esposas de dotación estándar con llaves de seguridad.', 92000, 40, true, 'Herramientas'],
  [ 'Lazos de retención plásticos (x50)', 'Bridas de seguridad de un solo uso para detenciones múltiples.', 28000, 100, true, 'Herramientas'],
  [ 'Llave universal de grilletes', 'Llave alargada táctica para apertura rápida.', 19500, 50, false, 'Herramientas'],
  [ 'Herramienta multifunción táctica', 'Alicates multitarea para corte de cables o reparaciones de emergencia.', 87000, 30, false, 'Herramientas'],
  [ 'Navaja de rescate', 'Herramienta con rompecristales y cortacinturones integrada.', 54000, 45, false, 'Herramientas'],
  [ 'Cizalla portátil de apertura forzada', 'Equipamiento ligero para aperturas forzadas en entradas tácticas.', 325000, 10, true, 'Herramientas'],
  [ 'Funda de pistola nivel III', 'Funda rígida (Kydex/polímero) con sistema de seguridad mecánico.', 158000, 20, true, 'Fundas y portas'],
  [ 'Portagrilletes técnico', 'Funda de extracción rápida en polímero o cordura de alta resistencia.', 42000, 30, true, 'Fundas y portas'],
  [ 'Portacargadores dobles', 'Compartimentos con retención por presión para munición de reserva.', 61000, 25, true, 'Fundas y portas'],
  [ 'Tahalí portadefensa', 'Soporte rotatorio para defensa de polímero o bastón extensible.', 49500, 20, true, 'Fundas y portas'],
  [ 'Kit de anclajes MOLLE', 'Sistema de cintas entrelazadas para acoplar bolsillos al chaleco táctico.', 33000, 50, false, 'Fundas y portas'],
  [ 'Radio portátil digital (TETRA)', 'Terminal con encriptación digital para comunicaciones operativas.', 1480000, 5, false, 'Tecnología'],
  [ 'Micrófono de solapa', 'Extensión de audio manos libres conectada a la radio.', 65000, 40, false, 'Tecnología'],
  [ 'Cámara corporal (Bodycam)', 'Sistema de grabación de audio y video con activación automática por eventos.', 520000, 15, false, 'Tecnología'],
  [ 'Baliza de localización GPS', 'Sistema portátil para seguimiento de flotas o activos en operaciones.', 340000, 10, false, 'Tecnología'],
  [ 'Torniquete táctico (tipo CAT)', 'Dispositivo de compresión para frenar hemorragias masivas en extremidades.', 68000, 60, false, 'Primeros auxilios'],
  [ 'Vendaje israelí de emergencia', 'Vendaje con barra de presión integrada para heridas profundas.', 34500, 80, false, 'Primeros auxilios'],
  [ 'Agente hemostático (gasa)', 'Gasa impregnada en sustancias que aceleran la coagulación sanguínea.', 52000, 40, false, 'Primeros auxilios'],
  [ 'Tijeras de rescate reforzadas', 'Tijeras capaces de cortar ropa gruesa, cuero o cinturones.', 31000, 50, false, 'Primeros auxilios'],
  [ 'Parche torácico oclusivo', 'Apósito con válvula para el tratamiento de neumotórax abierto.', 46500, 30, false, 'Primeros auxilios'],
  [ 'Kit de revelado de huellas', 'Polvos magnéticos, brochas de fibra de vidrio y cintas de trasplante.', 128000, 15, false, 'Criminalística'],
  [ 'Linterna forense UV (Luz de Wood)', 'Detección de fluidos biológicos y fibras en escena.', 215000, 10, false, 'Criminalística'],
  [ 'Kit de bolsas de evidencia', 'Envases con cierre hermético numerado y precintos de seguridad.', 47000, 60, false, 'Criminalística'],
  [ 'Testigos métricos numerados', 'Tarjetas plásticas L-shaped para fotografiar indicios a escala.', 22500, 40, false, 'Criminalística'],
  [ 'Kit de recolección de ADN', 'Hisopos estériles y tubos de ensayo para muestras biológicas.', 89000, 20, false, 'Criminalística'],
];

const IMAGENES_POR_PRODUCTO = [
  ['uniforme|camuflaje|gala', 'Uniforme operativo.jpg'],
  ['bota', 'Botas Tacticas antideslizantes.jpg'],
  ['chaleco|aramida|armana', 'chaleco balistico.jpg'],
  ['casco|antidisturbios', 'Casco de proteccion urbana.jpg'],
  ['pantalon', 'Pantalon tactico de dotacion.jpg'],
  ['polo', 'polo tecnico antibacterial.jpeg'],
  ['chaqueton', 'chaqueton de alta visibilidad.jpg'],
  ['cinturon', 'cinturon de dotacion.jpg'],
  ['placa', 'placas balisticas traumaticas.jpg'],
  ['guante', 'Guantes anticorte y antipinchazo.jpg'],
  ['gafa', 'Gafas tacticas de proteccion.jpg'],
  ['alcohol', 'Alcoholimetro digital evidencial.jpg'],
  ['drogas', 'kit de detecion de drogas.jpg'],
  ['sonometro', 'Sonometro digital.jpg'],
  ['cinemometro', 'Cinemometro laser.jpg'],
  ['cono', 'cono de señalizacion con linterna.jpg'],
  ['grillete', 'Grillete Metalicos de bisagra.jpg'],
  ['lazo', 'Lazos de retencion plastico.jpg'],
  ['llave', 'Llave universal de grilletes.jpg'],
  ['multifuncion', 'Herramienta multifuncion tactica.jpg'],
  ['navaja', 'navaja de rescate.jpg'],
  ['cizalla', 'Cizalla portatil de apertura forzada.jpg'],
  ['funda', 'Funda pistola nivel III.jpg'],
  ['portagrilletes', 'portagrilletes tecnico.webp'],
  ['portacargadores', 'portacargadores dobles.jpg'],
  ['tahali', 'Tahali portadefensa.jpg'],
  ['anclajes', 'Kit de anclajes MOLLE.webp'],
  ['radio', 'Radio portatil digital.jpg'],
  ['microfono', 'Microfono de solapa.jpg'],
  ['camara', 'camara corporal.jpg'],
  ['baliza', 'Baliza de localizacion GPS.jpg'],
  ['torniquete', 'Torniquete tactico.jpg'],
  ['vendaje', 'Vendaje israeli de emergencia.jpg'],
  ['hemostatico', 'Agente Hemostatico.jpg'],
  ['tijera', 'Tijeras de rescate reforzadas.jpg'],
  ['parche', 'parche toracico oclusivo.jpg'],
  ['revelado', 'kit de revelado de huellas.jpg'],
  ['forense', 'Linterna forence UV.jpg'],
  ['bolsas', 'Kit de bolsas de evidencia.jpg'],
  ['testigos', 'testigos metricos numerados.jpg'],
  ['adn', 'kit de recoleccion de adn.jpg'],
];

function imagenProductoPorNombre(nombre) {
  const nombreNormalizado = String(nombre || '').toLowerCase();
  const coincidencia = IMAGENES_POR_PRODUCTO.find(([patron]) => new RegExp(patron).test(nombreNormalizado));
  return coincidencia ? coincidencia[1] : null;
}



async function migrar() {
  // Clientes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre_unidad VARCHAR(255),
      direccion_instalacion VARCHAR(255),
      nit VARCHAR(100),
      nombre_funcionario TEXT,
      correo TEXT,
      telefono TEXT,
      direccion_entrega TEXT,
      autorizacion_general BOOLEAN DEFAULT FALSE,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Datos sensibles
  await pool.query(`
    CREATE TABLE IF NOT EXISTS datos_sensibles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cliente_id INT NOT NULL,
      numero_consulta_antecedentes TEXT,
      autorizacion_sensible BOOLEAN DEFAULT FALSE,
      fecha_autorizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  // Categorías
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL UNIQUE,
      descripcion TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Productos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      descripcion TEXT,
      precio DECIMAL(10,2) NOT NULL,
      imagen VARCHAR(255),
      cantidad_disponible INT DEFAULT 0,
      estado ENUM('activo','inactivo') DEFAULT 'activo',
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      restringido BOOLEAN DEFAULT FALSE,
      categoria_id INT,
      macrocategoria ENUM('general','vestimenta','herramientas') DEFAULT 'general',
      metadatos JSON NULL,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Atenciones
  await pool.query(`
    CREATE TABLE IF NOT EXISTS atenciones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      conversacion_id VARCHAR(100),
      calificacion INT,
      comentario TEXT,
      escalado_a_humano BOOLEAN DEFAULT FALSE,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Usuarios
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      correo VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      cliente_id INT,
      session_version INT UNSIGNED NOT NULL DEFAULT 0,
      rol ENUM('cliente','admin') DEFAULT 'cliente',
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

    // Refresh tokens (para renovar la sesión sin volver a pedir login)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_expiracion DATETIME NOT NULL,
      mfa_verificado_en DATETIME NULL,
      revocado BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS retos_mfa (
      reto_id CHAR(64) PRIMARY KEY,
      usuario_id INT NOT NULL,
      codigo_hash CHAR(64) NOT NULL,
      estado ENUM('pendiente','verificado','expirado','cancelado','bloqueado') NOT NULL DEFAULT 'pendiente',
      intentos TINYINT UNSIGNED NOT NULL DEFAULT 0,
      reenvios TINYINT UNSIGNED NOT NULL DEFAULT 0,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      enviado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expira_en DATETIME NOT NULL,
      proposito ENUM('inicio_sesion','cambio_correo') NOT NULL DEFAULT 'inicio_sesion',
      correo_destino_cifrado TEXT NULL,
      INDEX idx_retos_mfa_usuario_estado (usuario_id, estado, expira_en),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  
  // Pedidos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cliente_id INT NOT NULL,
      fecha_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
      items JSON NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      estado ENUM('pendiente','pendiente_pago','pagado','expirado','rechazado','confirmado','preparado','enviado','entregado','cancelado') DEFAULT 'pendiente',
      datos_comprador_cifrados TEXT NULL,
      direccion_entrega_cifrada TEXT NULL,
      enviar_comprobante BOOLEAN NOT NULL DEFAULT FALSE,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pagos (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      pedido_id INT NOT NULL,
      proveedor VARCHAR(32) NOT NULL,
      referencia_externa VARCHAR(191) NULL UNIQUE,
      idempotency_key VARCHAR(128) NOT NULL UNIQUE,
      request_hash CHAR(64) NOT NULL,
      widget_token VARCHAR(191) NULL,
      widget_url TEXT NULL,
      estado ENUM('creado','pendiente','aprobado','rechazado','expirado','reembolsado') NOT NULL DEFAULT 'creado',
      monto_centavos BIGINT UNSIGNED NOT NULL,
      moneda CHAR(3) NOT NULL DEFAULT 'COP',
      metodo VARCHAR(32) NULL,
      expira_en DATETIME NOT NULL,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pagos_pedido_estado (pedido_id, estado),
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS eventos_pago (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      evento_id VARCHAR(191) NOT NULL UNIQUE,
      proveedor VARCHAR(32) NOT NULL,
      pago_id BIGINT UNSIGNED NOT NULL,
      payload_hash CHAR(64) NOT NULL,
      recibido_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comprobantes (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      pedido_id INT NOT NULL UNIQUE,
      numero VARCHAR(40) NOT NULL UNIQUE,
      enviar_correo BOOLEAN NOT NULL DEFAULT FALSE,
      enviado_cliente_en DATETIME NULL,
      enviado_admin_en DATETIME NULL,
      token_hash CHAR(64) NULL,
      expira_en DATETIME NULL,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS correo_outbox (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      comprobante_id BIGINT UNSIGNED NOT NULL,
      tipo ENUM('cliente','admin') NOT NULL,
      estado ENUM('pendiente','procesando','enviado','fallido') NOT NULL DEFAULT 'pendiente',
      intentos TINYINT UNSIGNED NOT NULL DEFAULT 0,
      disponible_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ultimo_error_code VARCHAR(64) NULL,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      enviado_en DATETIME NULL,
      INDEX idx_correo_outbox_pendiente (estado, disponible_en, id),
      INDEX idx_correo_outbox_comprobante (comprobante_id, tipo, estado),
      FOREIGN KEY (comprobante_id) REFERENCES comprobantes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS solicitudes_reenvio_comprobante (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      comprobante_id BIGINT UNSIGNED NOT NULL,
      usuario_id INT NOT NULL,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reenvio_comprobante_usuario_fecha (comprobante_id, usuario_id, creado_en),
      FOREIGN KEY (comprobante_id) REFERENCES comprobantes(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS automation_outbox (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      workflow ENUM('W1','W3','W6','W8') NOT NULL,
      dedupe_key VARCHAR(191) NOT NULL UNIQUE,
      payload JSON NOT NULL,
      payload_cifrado BOOLEAN NOT NULL DEFAULT FALSE,
      estado ENUM('pendiente','procesando','enviado','fallido') NOT NULL DEFAULT 'pendiente',
      intentos TINYINT UNSIGNED NOT NULL DEFAULT 0,
      disponible_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ultimo_error_code VARCHAR(64) NULL,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_automation_outbox_pendiente (estado, disponible_en, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(
    "ALTER TABLE automation_outbox MODIFY workflow ENUM('W1','W3','W6','W8') NOT NULL"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS faq_asistente (
      id INT AUTO_INCREMENT PRIMARY KEY,
      palabras_clave VARCHAR(500) NOT NULL,
      pregunta VARCHAR(255) NOT NULL UNIQUE,
      respuesta TEXT NOT NULL,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_faq_asistente_activo (activo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS asistente_pendientes (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      conversacion_id VARCHAR(100) NOT NULL,
      texto_normalizado VARCHAR(500) NOT NULL,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atendido BOOLEAN NOT NULL DEFAULT FALSE,
      INDEX idx_asistente_pendientes_fecha (atendido, creado_en)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    INSERT IGNORE INTO faq_asistente (palabras_clave, pregunta, respuesta, activo)
    VALUES
      ('envio entrega domicilio', '¿Cuáles son los tiempos y zonas de envío?', '[COMPLETAR: política de envíos aprobada]', TRUE),
      ('garantia producto', '¿Qué garantía tienen los productos?', '[COMPLETAR: política de garantías aprobada]', TRUE),
      ('devolucion cambio', '¿Cómo puedo solicitar una devolución o cambio?', '[COMPLETAR: política de devoluciones aprobada]', TRUE),
      ('horario atencion', '¿Cuál es el horario de atención?', '[COMPLETAR: horario oficial de atención]', TRUE),
      ('pago metodos medios', '¿Qué métodos de pago están habilitados?', '[COMPLETAR: medios de pago habilitados]', TRUE),
      ('datos privacidad habeas', '¿Cómo se tratan mis datos personales?', '[COMPLETAR: aviso de privacidad y canal de Habeas Data aprobados]', TRUE)
  `);

  // Detalle de pedidos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS detalle_pedido (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pedido_id INT NOT NULL,
      producto_id INT NOT NULL,
      cantidad INT NOT NULL,
      precio_unitario DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
      FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Reportes / sugerencias de clientes (módulo 4 - vista del cliente)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reportes_cliente (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cliente_id INT NOT NULL,
      comentario TEXT NOT NULL,
      calificacion INT NOT NULL,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Auditoría de acciones administrativas (crear / editar / eliminar)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT,
      correo VARCHAR(255),
      accion ENUM('crear','editar','eliminar') NOT NULL,
      entidad VARCHAR(50) NOT NULL,
      entidad_id VARCHAR(50),
      detalle TEXT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log('[db] Tablas verificadas/creadas correctamente.');

  await migrarColumnasFaltantes();
  await migrarAutenticacionMfa();
  await migrarCuentaSegura();
  await sembrarCategoriasYProductos();
  await sembrarAdminPorDefecto();
}

async function migrarAutenticacionMfa() {
  try {
    await pool.query('ALTER TABLE refresh_tokens ADD COLUMN mfa_verificado_en DATETIME NULL');
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) {
      throw err;
    }
  }

  try {
    await pool.query('ALTER TABLE retos_mfa ADD COLUMN reenvios TINYINT UNSIGNED NOT NULL DEFAULT 0');
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) {
      throw err;
    }
  }

}

async function migrarCuentaSegura() {
  for (const [tabla, columna, definicion] of [
    ['usuarios', 'session_version', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['retos_mfa', 'proposito', "ENUM('inicio_sesion','cambio_correo') NOT NULL DEFAULT 'inicio_sesion'"],
    ['retos_mfa', 'correo_destino_cifrado', 'TEXT NULL'],
    ['automation_outbox', 'payload_cifrado', 'BOOLEAN NOT NULL DEFAULT FALSE']
  ]) {
    try {
      await pool.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    } catch (err) {
      if (!/duplicate column/i.test(err.message)) throw err;
    }
  }

  await pool.query(
    "ALTER TABLE automation_outbox MODIFY workflow ENUM('W1','W3','W6','W8') NOT NULL"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS solicitudes_cuenta (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      cliente_id INT NOT NULL,
      campo ENUM('nit','nombreUnidad','eliminacion','correccion') NOT NULL,
      detalle TEXT NOT NULL,
      estado ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
      resuelta_por INT NULL,
      respuesta_admin VARCHAR(500) NULL,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resuelta_en DATETIME NULL,
      INDEX idx_solicitudes_cuenta_estado (estado, creado_en, id),
      INDEX idx_solicitudes_cuenta_cliente (cliente_id, creado_en),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
      FOREIGN KEY (resuelta_por) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

// Ajustes a instalaciones ya existentes (creadas antes de agregar estas
// columnas/valores). Cada ALTER va en su propio try/catch: si la base ya
// tiene el cambio aplicado, MySQL lanza error y simplemente se ignora.
async function migrarColumnasFaltantes() {
  // Mantiene compatibles las instalaciones antiguas con el timeline operativo.
  await pool.query(
    "ALTER TABLE pedidos MODIFY estado ENUM('pendiente','pendiente_pago','pagado','expirado','rechazado','confirmado','preparado','enviado','entregado','cancelado') DEFAULT 'pendiente'"
  );

  for (const [columna, definicion] of [
    ['datos_comprador_cifrados', 'TEXT NULL'],
    ['direccion_entrega_cifrada', 'TEXT NULL'],
    ['enviar_comprobante', 'BOOLEAN NOT NULL DEFAULT FALSE']
  ]) {
    try {
      await pool.query(`ALTER TABLE pedidos ADD COLUMN ${columna} ${definicion}`);
    } catch (err) {
      if (!/duplicate column/i.test(err.message)) {
        throw err;
      }
    }
  }

  try {
    await pool.query("ALTER TABLE productos ADD COLUMN macrocategoria ENUM('general','vestimenta','herramientas') DEFAULT 'general'");
  } catch (err) {
    console.warn('[db] No se pudo agregar macrocategoria a productos:', err.message);
  }

  try {
    await pool.query("ALTER TABLE productos ADD COLUMN metadatos JSON NULL");
  } catch (err) {
    console.warn('[db] No se pudo agregar metadatos a productos:', err.message);
  }

  const indices = [
    ['pedidos', 'idx_pedidos_cliente_fecha', 'cliente_id, fecha_pedido'],
    ['reportes_cliente', 'idx_reportes_cliente_fecha', 'cliente_id, fecha'],
    ['productos', 'idx_productos_estado_stock', 'estado, cantidad_disponible']
  ];
  for (const [tabla, indice, columnas] of indices) {
    try {
      const [existente] = await pool.query(
        'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
        [tabla, indice]
      );
      if (!existente.length) {
        await pool.query(`CREATE INDEX ${indice} ON ${tabla} (${columnas})`);
      }
    } catch (err) {
      console.warn(`[db] No se pudo verificar/crear el índice ${indice}:`, err.message);
    }
  }
}

// Inserta las categorías y productos de ejemplo SOLO la primera vez
// (si la tabla ya tiene datos, no hace nada — evita duplicar en cada reinicio).
async function sembrarCategoriasYProductos() {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM categorias');
  if (total === 0) {
    for (const [nombre, descripcion] of CATEGORIAS_SEED) {
      await pool.query('INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)', [nombre, descripcion]);
    }

    const [categorias] = await pool.query('SELECT id, nombre FROM categorias');
    const idPorNombre = Object.fromEntries(categorias.map(c => [c.nombre, c.id]));

    for (const [nombre, descripcion, precio, cantidad, restringido, nombreCategoria] of PRODUCTOS_SEED) {
      await pool.query(
        `INSERT INTO productos (nombre, descripcion, precio, imagen, cantidad_disponible, estado, restringido, categoria_id)
         VALUES (?, ?, ?, ?, ?, 'activo', ?, ?)`,
        [nombre, descripcion, precio, imagenProductoPorNombre(nombre), cantidad, restringido, idPorNombre[nombreCategoria] || null]
      );
    }

    console.log(`[db] Sembradas ${CATEGORIAS_SEED.length} categorías y ${PRODUCTOS_SEED.length} productos de ejemplo.`);
  }

  const [productosSinImagen] = await pool.query('SELECT id, nombre FROM productos WHERE imagen IS NULL OR imagen = ""');
  for (const producto of productosSinImagen) {
    const imagen = imagenProductoPorNombre(producto.nombre);
    if (imagen) await pool.query('UPDATE productos SET imagen = ? WHERE id = ?', [imagen, producto.id]);
  }
}

// Crea una cuenta de administrador la primera vez que se arranca el backend,
// si todavía no existe ninguna. La contraseña se imprime UNA sola vez en la
// consola del servidor — cámbiala apenas inicies sesión.
async function sembrarAdminPorDefecto() {
  const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'admin'");
  if (total > 0) return;

  const correo = process.env.ADMIN_EMAIL || 'admin@suministros.local';
  const passwordTemporal = process.env.ADMIN_PASSWORD || 'CambiaEstaClave123';
  const hash = await bcrypt.hash(passwordTemporal, 10);

  await pool.query(
    "INSERT INTO usuarios (correo, password_hash, rol) VALUES (?, ?, 'admin')",
    [correo, hash]
  );

  console.log('==============================================================');
  console.log('[db] Cuenta de administrador creada automáticamente:');
  console.log(`      correo:    ${correo}`);
  console.log(`      password:  ${passwordTemporal}`);
  console.log('      Inicia sesión y cambia esta contraseña cuanto antes.');
  console.log('      (Puedes fijar ADMIN_EMAIL / ADMIN_PASSWORD en tu .env para elegirla tú mismo).');
  console.log('==============================================================');
}

module.exports = { pool, migrar, migrarCuentaSegura };
