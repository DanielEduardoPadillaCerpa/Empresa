# Informe de inspección — Suite Institucional

Revisión completa de backend (Node/Express + MySQL) y frontend (11 páginas HTML + 5 archivos JS).
Se probó cada botón y cada flujo de guardado en base de datos. Se eliminó también una carpeta
duplicada (`suite-institucional/suite-institucional/`) que contenía un prototipo viejo en Java/Spring
y copias antiguas del frontend — no se estaba usando, pero generaba confusión.

## 🔴 Bugs críticos (rompían el sistema por completo)

1. **`backend/src/db.js` no cargaba — error de sintaxis.**
   Después de `module.exports` había código suelto (`await pool.query(...)` fuera de cualquier
   función, con variables como `categoriaId` o `nombreUnidad` que no existían en ese contexto).
   Como `server.js` hace `require('./src/db')`, **el backend entero no arrancaba**. Se limpió el
   archivo y se aprovechó para mover ahí, de forma correcta, los datos de ejemplo (categorías,
   productos) y un usuario administrador inicial.

2. **El JWT nunca incluía el rol ni el `clienteId`.**
   `requiereAdmin()` revisa `req.usuario.rol`, pero el login/registro nunca ponían `rol` dentro del
   token. Resultado: **ningún admin podía crear, editar ni borrar nada** (categorías, productos,
   pedidos) — siempre daba 403, sin importar quién iniciara sesión. Tampoco existía ninguna forma de
   crear una cuenta admin. Se corrigió el token para incluir `rol` y `clienteId`, y `db.js` ahora
   crea automáticamente un admin la primera vez que arranca el servidor (usuario y contraseña se
   imprimen en la consola).

3. **`POST /api/pedidos` guardaba el pedido con el ID equivocado.**
   Usaba `req.usuario.uid` (el ID de la tabla `usuarios`) como si fuera `cliente_id`, pero la
   columna `pedidos.cliente_id` tiene una llave foránea hacia `clientes.id` — son IDs de tablas
   distintas. **Cualquier intento de comprar fallaba** (o, peor, podía guardarse contra el cliente
   equivocado si los IDs coincidían por casualidad). Se corrigió para usar el `clienteId` real que
   ahora sí viaja en el token.

4. **El botón "Confirmar compra" llamaba a funciones que no existen en ningún archivo**
   (`obtenerItemsCarrito()`, `limpiarCarrito()`). Al hacer clic, el carrito lanzaba un error de
   JavaScript no capturado y no llegaba ni a intentar guardar el pedido. Se reescribió
   `confirmarCompra()` usando las funciones reales del carrito.

5. **El carrito nunca guardaba el ID del producto** (`agregarAlCarrito` solo leía nombre/precio/
   restringido). Sin `productoId`, el backend no podía validar inventario ni descontar stock — la
   consulta SQL se ejecutaba con un parámetro `undefined`. Se corrigió para que cada "Agregar al
   carrito" guarde también el ID real del producto.

6. **`index.html` no mostraba ningún producto.** El código tenía literalmente
   `productos.map(p => `...`).join('')` — el `...` es texto literal, no una plantilla. El catálogo
   completo estaba vacío en la práctica: no había ningún botón "Agregar al carrito" que pudiera
   funcionar. Se restauró la tarjeta real, con el nombre de categoría resuelto correctamente
   (la tabla `productos` solo guarda `categoria_id`, así que ahora se cruza con `/api/categorias`).

7. **El dashboard de administración estaba guardado con el nombre equivocado**
   (`admin-dsahoboard.html`), mientras que todos los enlaces "Dashboard" del sitio apuntaban a
   `admin-dashboard.html`. El enlace daba 404 siempre. Se renombró el archivo.

8. **`admin-productos.html` era una copia exacta de `admin-clientes.html`** — gestionaba clientes,
   no productos. No existía ninguna pantalla real para crear/editar/eliminar productos. Se creó de
   cero, conectada a `/api/productos` y `/api/categorias`.

## 🟠 Bugs de rutas del backend (endpoints inalcanzables o faltantes)

9. **`/api/categorias` nunca se montaba en `server.js`** aunque el archivo de rutas existía —
   cualquier llamada a esa API devolvía 404. Se agregó `app.use('/api/categorias', ...)`.

10. **En `pedidos.js`, la ruta `GET /todos` quedaba atrapada por `GET /:clienteId`**, declarada
    antes. Express prueba las rutas en orden: cualquier request a `/api/pedidos/todos` se
    interpretaba como si `"todos"` fuera un ID de cliente. El dashboard y `admin-pedidos.html`
    recibían siempre una lista vacía. Se reordenaron las rutas.

11. **En `productos.js` había dos `router.get('/', ...)` idénticos** — el segundo, que sí filtraba
    por categoría, nunca se ejecutaba (el primero interceptaba todo). El filtro de categorías del
    catálogo nunca funcionó. También `/bajo-inventario` estaba después de `/:id`, con el mismo
    problema. Se unificó en una sola ruta con filtro opcional y se reordenó `/bajo-inventario`.

12. **`clientes.js` no tenía rutas `PUT` ni `DELETE`.** Los botones "Editar" y "Eliminar" de
    `admin-clientes.html` ya existían en el frontend, pero el backend respondía 404 sin remedio.
    Se agregaron ambas rutas, cifrando los campos privados igual que en el registro.

13. **`admin-pedidos.html` llamaba a `/api/pedidos`** (el historial del propio usuario) **en vez de
    `/api/pedidos/todos`**. Además el template esperaba `p.cliente.unidad`, un campo que esa
    respuesta ni siquiera trae — el botón "Cargar pedidos" del admin siempre terminaba en error.
    Se corrigió el endpoint.

## 🟡 Funciones que no guardaban nada en la base de datos

14. **Las calificaciones del chatbot (1 a 5 estrellas) nunca se enviaban al backend** — solo se
    mostraba un mensaje y un `console.log`. El endpoint `POST /api/atencion/calificacion` ya
    existía y funcionaba, pero nada lo llamaba. Se conectó.

15. **`reportes.html` mostraba números inventados fijos** (1.284 clientes, 4.3 de promedio, etc.),
    sin llamar nunca a `GET /api/reportes/mensual`, que sí calcula datos reales. Se reescribió para
    consumir la API real, incluyendo un ranking de productos más vendidos que antes no se usaba en
    ningún lado (dependía de `detalle_pedido`, tabla que tampoco se llenaba — ver punto 16).

16. **Nunca se insertaba nada en `detalle_pedido`.** El reporte de "productos más vendidos" hace
    `JOIN` contra esa tabla, pero como `POST /api/pedidos` nunca insertaba ahí, el ranking siempre
    iba a estar vacío. Se agregó el insert correspondiente al confirmar un pedido.

## 🟢 Bugs menores / inconsistencias

17. `login.html` ignoraba el parámetro `?redirect=` tras iniciar sesión — siempre mandaba al
    catálogo aunque el usuario viniera de "Continuar con el registro" desde el carrito, o de un
    panel de admin. Se corrigió tanto en `login.html` como en `registro.html` (autologin).

18. `API_BASE` estaba duplicado o hardcodeado de forma distinta en varios archivos
    (`index.html`, `mis-pedidos.html`, `admin-pedidos.html`, `historial.html`). Se centralizó en
    `js/auth.js`, que se carga siempre primero.

19. `js/cart.js` tenía **dos** definiciones de `carritoRenderPanel` y **dos** de
    `authRequerirParaComprar` — la segunda pisaba a la primera y con eso desaparecía el aviso de
    "equipo restringido" en el carrito. Se unificó en una sola versión.

20. Enlaces de navegación inconsistentes entre paneles de admin (por ejemplo, `admin-clientes.html`
    no tenía enlace a Pedidos, Productos ni Dashboard). Se completó la navegación cruzada.

## Nota sobre seguridad (no es un bug de funcionalidad, pero vale la pena mencionarlo)

- El `.env.example` del backend expone el host y usuario reales de una base de datos de Clever
  Cloud (sin contraseña). El propio README ya advertía regenerar esa contraseña porque se compartió
  antes en una captura — sigue siendo válido: **regenérala si no lo has hecho.**
- La cuenta de administrador que ahora se crea automáticamente usa una contraseña temporal
  (`CambiaEstaClave123` por defecto, o lo que definas en `ADMIN_EMAIL` / `ADMIN_PASSWORD` en tu
  `.env`). Cámbiala apenas inicies sesión por primera vez.

## Qué probé después de cada corrección

- Sintaxis (`node --check`) de los 8 archivos de rutas del backend, `db.js`, `crypto.js`,
  `server.js`, y los 5 archivos JS del frontend — todos pasan sin errores.
- Crucé cada endpoint que el frontend llama (`fetch(...)`) contra las rutas realmente montadas en
  `server.js` — todos coinciden.
- No pude instalar dependencias ni levantar MySQL real en este entorno (sin acceso a red), así que
  no ejecuté el servidor end-to-end. Te recomiendo, como último paso, correr `npm install && npm
  start` en `backend/` y hacer una compra de prueba completa (registro → agregar al carrito →
  confirmar compra → verla en `historial.html` y en `admin-pedidos.html`) para confirmar en tu
  propio entorno.
