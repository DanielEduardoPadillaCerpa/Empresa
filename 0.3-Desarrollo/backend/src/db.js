const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
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
      revocado BOOLEAN DEFAULT FALSE,
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
      estado ENUM('pendiente','enviado','entregado') DEFAULT 'pendiente',
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
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
  await sembrarCategoriasYProductos();
  await sembrarAdminPorDefecto();
}

// Ajustes a instalaciones ya existentes (creadas antes de agregar estas
// columnas/valores). Cada ALTER va en su propio try/catch: si la base ya
// tiene el cambio aplicado, MySQL lanza error y simplemente se ignora.
async function migrarColumnasFaltantes() {
  // El estado "cancelado" no existía en versiones anteriores del ENUM.
  try {
    await pool.query(
      "ALTER TABLE pedidos MODIFY estado ENUM('pendiente','enviado','entregado','cancelado') DEFAULT 'pendiente'"
    );
  } catch (err) {
    console.warn('[db] No se pudo ajustar el ENUM de pedidos.estado (puede que ya esté actualizado):', err.message);
  }
}

// Inserta las categorías y productos de ejemplo SOLO la primera vez
// (si la tabla ya tiene datos, no hace nada — evita duplicar en cada reinicio).
async function sembrarCategoriasYProductos() {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM categorias');
  if (total > 0) return;

  for (const [nombre, descripcion] of CATEGORIAS_SEED) {
    await pool.query('INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)', [nombre, descripcion]);
  }

  const [categorias] = await pool.query('SELECT id, nombre FROM categorias');
  const idPorNombre = Object.fromEntries(categorias.map(c => [c.nombre, c.id]));

  for (const [nombre, descripcion, precio, cantidad, restringido, nombreCategoria] of PRODUCTOS_SEED) {
    await pool.query(
      `INSERT INTO productos (nombre, descripcion, precio, cantidad_disponible, estado, restringido, categoria_id)
       VALUES (?, ?, ?, ?, 'activo', ?, ?)`,
      [nombre, descripcion, precio, cantidad, restringido, idPorNombre[nombreCategoria] || null]
    );
  }

  console.log(`[db] Sembradas ${CATEGORIAS_SEED.length} categorías y ${PRODUCTOS_SEED.length} productos de ejemplo.`);
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

module.exports = { pool, migrar };
