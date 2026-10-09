# Backend — Suministros Institucionales (Node.js + Express)

Backend en Node.js, pensado para correr directo en VS Code, sin Java ni Spring Boot.

## 1. Requisitos

- Node.js 18 o superior instalado (`node -v` para verificar).
- La base de datos MySQL de Clever Cloud ya creada (la que ya tienes).

## 2. Instalación

Abre esta carpeta en VS Code, abre una terminal (Ctrl + ñ o Terminal → New Terminal) y ejecuta:

```bash
npm install
```

## 3. Configurar variables de entorno

1. Copia `.env.example` y renómbralo a `.env`.
2. Completa `DB_PASSWORD` con la contraseña de tu base (recuerda regenerarla en Clever Cloud, ya que se compartió antes en una captura de pantalla).
3. Cambia `CRYPTO_KEY` por una clave propia de 32 caracteres (no dejes la de ejemplo).
4. Conserva `DB_CONNECTION_LIMIT=4` o ajústalo a un valor menor según el límite de conexiones de tu proveedor. El backend lo limita a cuatro para evitar agotar el cupo de MySQL con consultas concurrentes.
5. Configura SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y, si aplica, `SMTP_FROM`) para comprobantes. El MFA usa `N8N_MFA_WEBHOOK_URL` y `N8N_MFA_WEBHOOK_SECRET`; crea un secreto exclusivo de al menos 32 caracteres. Configura `MFA_TOKEN_PEPPER`, `PAYMENT_WEBHOOK_SECRET` y `RECEIPT_LINK_SECRET` con valores aleatorios independientes.
6. Si activas automatizaciones, configura además los secretos W1-W4 y URL correspondientes descritos abajo. `ADMIN_NOTIFICATION_EMAIL` y `RECEIPT_LINK_BASE_URL` determinan el aviso de comprobantes y el enlace seguro del cliente.

Genera un valor aleatorio independiente para cada secreto con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y guárdalos en el `.env` del backend. Nunca los pongas en el frontend, en Git o en capturas. En modo mock, el secreto de webhook puede generarse temporalmente en memoria para pruebas locales.

El archivo `.env` **no se sube a ningún repositorio** — ya está pensado para quedarse solo en tu máquina.

## 4. Ejecutar

```bash
npm start
```

Deberías ver en la terminal:
```
[db] Tablas verificadas/creadas correctamente.
[server] Backend corriendo en http://localhost:8081
```

Las tablas (`clientes`, `datos_sensibles`, `atenciones`) se crean automáticamente la primera vez que arranca — no necesitas ejecutar ningún script SQL a mano.

## 5. Probar

Abre en el navegador: `http://localhost:8081/api/clientes` → deberías ver `[]` (lista vacía) si aún no has registrado a nadie.

Con el backend corriendo, abre `frontend/registro.html` en el navegador, llena el formulario y dale a "Registrar cliente". Luego revisa `frontend/admin-clientes.html` para verlo listado.

## 6. Endpoints disponibles

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/clientes` | Lista todos los clientes |
| GET | `/api/clientes/:id` | Ver un cliente |
| POST | `/api/clientes` | Registrar cliente |
| POST | `/api/clientes/:id/dato-sensible` | Registrar antecedentes judiciales (con consentimiento) |
| POST | `/api/auth/registro` | Crear credenciales sin iniciar sesión automáticamente |
| POST | `/api/auth/login` | Validar contraseña e iniciar verificación MFA |
| POST | `/api/auth/mfa/verificar` | Verificar el código y emitir sesión |
| POST | `/api/auth/mfa/reenviar` | Reenviar el código (60 s de espera; máximo cinco reenvíos) |
| POST | `/api/auth/mfa/cancelar` | Cancelar un desafío pendiente |
| POST | `/api/auth/refresh` | Renovar una sesión que ya completó MFA |
| POST | `/api/atencion/calificacion` | Registrar calificación del chatbot |
| POST | `/api/atencion/mensaje` | Proxy del chatbot al workflow de n8n |
| POST | `/api/checkout` | Crear pedido pendiente y reservar inventario (JWT e `Idempotency-Key`) |
| POST | `/api/pagos/webhook/mock` | Aplicar un evento mock firmado |
| POST | `/api/pagos/dev/simular-webhook` | Simular el resultado del proveedor mock (JWT) |
| GET | `/api/pagos/:pedidoId/estado` | Consultar el pago propio |
| GET | `/api/comprobantes/:pedidoId` | Obtener el comprobante del pedido propio (JWT) |
| GET | `/api/comprobantes/:pedidoId?format=pdf` | Descargar el comprobante PDF (JWT) |
| POST | `/api/comprobantes/:pedidoId/reenviar` | Encolar reenvío si hubo consentimiento (máximo 3/hora) |
| GET | `/api/automatizaciones/resumen-diario` | Resumen de recaudo agregado (token W2) |
| POST | `/api/automatizaciones/pedidos/expirar` | Liberar reservas vencidas (token W4) |
| POST | `/api/pedidos` | Retirado; los pedidos solo se crean mediante `/api/checkout` |
| GET | `/api/reportes/mensual` | Reporte mensual (A, B, C) |

## Integraciones: checkout mock y n8n

### MFA por n8n

Después de validar la contraseña, el backend genera un código de seis dígitos, persiste solo su HMAC en `retos_mfa` y lo entrega a n8n como cartero. El backend sigue verificando el código y emitiendo JWT/refresh únicamente después de validarlo. El código vence en cinco minutos, admite cinco intentos y el reenvío espera un minuto (máximo cinco reenvíos). Si la entrega inicial falla, el reto se elimina para no consumir el límite de inicios de sesión.

Importa `../n8n/workflows/W5-mfa-email.json`, configura una credencial Webhook Header Auth con nombre `Authorization` y valor `Bearer <N8N_MFA_WEBHOOK_SECRET>`, y configura una credencial SMTP para el nodo de correo junto con `MFA_FROM_EMAIL`. Activa el workflow y copia su URL de producción (`/webhook/mfa-login-code`) en `N8N_MFA_WEBHOOK_URL`. En producción se exige HTTPS y se rechazan URLs `/webhook-test/`; el servidor falla al iniciar si faltan estas variables o su formato no es seguro. Configura SPF/DKIM/DMARC con el proveedor SMTP usado por n8n.

Si Gmail limita los envíos, una alternativa es el relay SMTP de Brevo en el nivel gratuito disponible para la cuenta; revisa sus límites vigentes y usa la credencial SMTP de Brevo en n8n sin cambiar el backend ni compartir la clave SMTP.

n8n recibe únicamente `event`, `email`, `token_mfa`, `timestamp` y `expires_in_seconds` para el MFA. El workflow valida los campos, entrega el correo y devuelve solo `{ok:true}` o un error, nunca el código. El workflow desactiva el guardado de ejecuciones exitosas, fallidas y manuales. No habilites el guardado de ejecuciones: el código existe en memoria durante el envío. Las rutas `/login`, `/mfa/verificar` y `/mfa/reenviar` también tienen limitación de solicitudes por IP.

La prueba manual, que envía el código ficticio `123456` al correo indicado, se ejecuta desde `backend/` con `node probar-mfa-n8n.js correo_destino@example.com`. No la ejecuté desde esta sesión para evitar enviar un mensaje externo. Para configurar sin revelar el secreto, comprueba localmente que `N8N_MFA_WEBHOOK_SECRET` tenga al menos 32 caracteres y que la URL use HTTPS y termine en el path del webhook activo.

### Checkout de Fase 1

`POST /api/checkout` exige JWT, una cabecera `Idempotency-Key` aleatoria de 16 a 128 caracteres y un carrito con IDs/cantidades. El cuerpo puede incluir `items`, `enviarComprobante`, `datosComprador`, `direccionEntrega` y `metodo`. El backend consulta precio e inventario desde MySQL, reserva unidades bajo `FOR UPDATE`, cifra los datos personales, y crea pedido y pago en una transacción. Los datos de tarjeta no se aceptan ni se guardan; la integración con widget/tokenización corresponde a la siguiente fase.

La respuesta contiene `pedido_id`, estado del pago, proveedor mock, `widget_token`, `widget_url` y expiración. El checkout web ofrece tres pasos: revisión del carrito, datos/método con preferencia de comprobante desmarcada y un modal de resultado. El navegador llama a `POST /api/pagos/dev/simular-webhook` con el ID del pedido; el resultado se determina en el servidor a partir de los centavos del importe: terminación `.01` rechaza, `.02` queda pendiente, `.03` simula timeout antes de reservar stock, y los demás importes se aprueban. El navegador no puede decidir el estado. Consulta el resultado con `GET /api/pagos/:pedidoId/estado`; solo el dueño puede consultarlo. El widget de una pasarela real permanece para la fase 5; el PDF y correo de comprobantes se implementaron en la fase 3.

El proveedor genera webhooks con HMAC-SHA256 sobre `timestamp + "." + cuerpo HTTP raw`, usando `x-payment-timestamp` y `x-payment-signature`. El servidor rechaza firmas inválidas y marcas de tiempo con más de cinco minutos, deduplica por `event_id` y valida referencia, moneda e importe antes de actualizar el pedido. `POST /api/pedidos` y `/api/pagos/procesar` están retirados.

### n8n — Fase 4

Los workflows importables están en `../n8n/workflows/`:

- `W1-alerta-pagos.json`: recibe eventos aprobados/rechazados y avisa al administrador.
- `W2-resumen-diario.json`: consulta el recaudo agregado de las últimas 24 horas y envía el resumen a las 08:00, zona `America/Bogota`.
- `W3-alerta-stock-bajo.json`: recibe una alerta genérica cuando algún producto activo alcanza el umbral configurado; el flujo no recibe IDs ni nombres de productos.
- `W4-expirar-pedidos.json`: cron cada minuto que invoca el endpoint protegido de expiración. El backend también ejecuta su propio job cada minuto, por lo que las reservas se liberan aunque n8n esté fuera de servicio.
- `W5-mfa-email.json`: workflow independiente que entrega el código MFA del login; es el único workflow que recibe correo y OTP temporal. Tiene guardado de ejecuciones desactivado.

Importa cada JSON desde **Workflows → Import from File**, configura credenciales SMTP en los nodos Email Send y define en el entorno de n8n `BACKEND_BASE_URL`, `ADMIN_ALERT_FROM`, `ADMIN_ALERT_TO`, `MFA_FROM_EMAIL`, `N8N_W1_SECRET`, `N8N_W2_DAILY_SUMMARY_TOKEN`, `N8N_W3_SECRET` y `N8N_W4_EXPIRY_TOKEN`. El endpoint de backend debe usar HTTPS desde n8n. Para las funciones Code que verifican HMAC, permite el módulo integrado `crypto` (`NODE_FUNCTION_ALLOW_BUILTIN=crypto`). No actives los workflows hasta configurar sus credenciales y secretos.

El backend encola W1 en la misma transacción que cambia el pedido a pagado/rechazado y firma el JSON canónico con HMAC-SHA256; los headers son `x-automation-timestamp` y `x-automation-signature`, con tolerancia de cinco minutos. W3 usa secreto independiente. La entrega tiene reintentos y backoff en `automation_outbox`; una caída de n8n no bloquea el checkout ni cambia el estado del pago. W2 recibe solo `{evento,total,moneda,fecha}`; W1 solo `{evento,pedido_id,estado,total,moneda,fecha}`; W3 solo `{evento,fecha}`. Ninguno recibe datos del comprador, tarjetas, OTP o tokens de sesión/pago. La excepción limitada es W5, que recibe exclusivamente el correo y el OTP temporal para entregarlo.

El resumen de ventas requiere `N8N_W2_DAILY_SUMMARY_TOKEN`; la expiración remota requiere `N8N_W4_EXPIRY_TOKEN`, ambos distintos y comparados en tiempo constante. W2 devuelve `total` como una cadena de centavos enteros. La expiración local cambia pedido y pago a vencidos, y libera inventario en una misma transacción con actualización condicional para no duplicar stock. El umbral de stock se lee de `AUTOMATION_STOCK_LOW_THRESHOLD`; se emite como máximo una alerta genérica al día.

En n8n detrás de proxy, habilita HTTPS y define `EXECUTIONS_DATA_SAVE_ON_SUCCESS=none` y `EXECUTIONS_DATA_SAVE_ON_ERROR=none` para no conservar ejecuciones; W5 también desactiva el guardado en sus ajustes. Mantén las credenciales en el almacén de n8n, no en los archivos exportados. El backend conserva únicamente campos permitidos en su outbox. El chatbot existente sigue separado y debe usarse solo para preguntas generales; no le envíes OTP, tarjetas ni otros datos personales.

La fase mock no constituye una pasarela de producción ni realiza cobros reales. `PAYMENT_MODE=sandbox` y `PAYMENT_MODE=prod` fallan de forma segura hasta contar con un adaptador del proveedor seleccionado y validado.

### Comprobantes y correos

Solo un evento de pago aprobado crea, dentro de la misma transacción, un comprobante no-DIAN y sus tareas de correo. Siempre se encola un aviso administrativo sin datos personales; solo se encola el mensaje al cliente si `enviarComprobante` fue `true` en el checkout. El cliente recibe un enlace PDF firmado con HMAC y vencimiento a 24 horas, nunca un adjunto. El endpoint de reenvío exige JWT del dueño y limita a tres solicitudes por hora. `correo_outbox` conserva el estado/reintentos y ejecuta backoff si falla SMTP; una falla de correo no altera ni revierte el pago.

Configura `ADMIN_NOTIFICATION_EMAIL`, `RECEIPT_LINK_SECRET` y `RECEIPT_LINK_BASE_URL` junto con SMTP. El enlace base debe ser HTTPS en producción (HTTP se permite solo para localhost). No envíes datos de compradores ni enlaces firmados a n8n. SPF, DKIM y DMARC deben configurarse con el proveedor de correo.

## 7. Nota de seguridad

Los campos privados (nombre del funcionario, correo, teléfono, dirección) y el dato sensible (antecedentes) se guardan cifrados con AES-256-GCM usando `CRYPTO_KEY`. Si pierdes esa clave, los datos cifrados ya guardados no se podrán volver a leer — guárdala en un lugar seguro, separada del código.
