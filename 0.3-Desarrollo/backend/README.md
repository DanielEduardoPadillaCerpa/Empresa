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
5. Configura `N8N_MFA_WEBHOOK_URL`, `N8N_MFA_WEBHOOK_SECRET` y `MFA_TOKEN_PEPPER` con valores propios; usa secretos distintos de `JWT_SECRET`. El inicio de sesión permanece bloqueado hasta que se configure el envío MFA.

Genera un valor aleatorio independiente para cada secreto con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y guárdalos en el `.env` del backend. Copia `N8N_MFA_WEBHOOK_SECRET` también a la credencial Header Auth del workflow n8n. Nunca los pongas en el frontend, en Git o en capturas.

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
| POST | `/api/pagos/procesar` | Verificar una solicitud de pago mediante n8n (requiere sesión) |
| GET | `/api/reportes/mensual` | Reporte mensual (A, B, C) |

## Integraciones n8n

### Autenticación MFA por correo

Después de validar la contraseña, `/api/auth/login` crea un desafío temporal y envía el siguiente JSON a `N8N_MFA_WEBHOOK_URL`. La respuesta HTTP del workflow debe ser 2xx únicamente después de que el nodo de correo haya aceptado el mensaje:

```json
{
  "event": "mfa.login.code",
  "email": "usuario@ejemplo.com",
  "token_mfa": "042817",
  "timestamp": "2026-10-05T16:30:00.000Z",
  "user_id": 123,
  "challenge_id": "identificador-aleatorio-de-64-caracteres-hexadecimales",
  "expires_in_seconds": 300
}
```

El webhook recibe `Authorization: Bearer <N8N_MFA_WEBHOOK_SECRET>`. Configura autenticación **Header Auth** en n8n para validar ese encabezado; no publiques el webhook sin autenticarlo. Debe usar HTTPS, salvo pruebas locales contra `localhost`. No registres el cuerpo completo del webhook en logs: contiene el código temporal.

Workflow sugerido:

1. **Webhook**: método `POST`, ruta privada para entrega de códigos, autenticación Header Auth para `Authorization` y respuesta gestionada al final del flujo mediante `Respond to Webhook`.
2. **Gmail**, **SMTP** o proveedor transaccional: destinatario `{{$json.body.email}}`, asunto `Código de verificación de acceso`, y cuerpo por ejemplo:

   ```text
   Tu código de acceso es: {{$json.body.token_mfa}}

   Vence en 5 minutos. Si no solicitaste este código, ignora este mensaje.
   No compartas el código con nadie.
   ```

3. **Respond to Webhook**: responder `200` con `{"ok":true}` solo después de que el envío haya sido aceptado. Configura la rama de error del nodo de correo para devolver un HTTP no exitoso; la aplicación cancela el desafío y no inicia sesión si falla la entrega.

En producción, verifica el dominio del remitente y configura SPF/DKIM/DMARC con el proveedor de correo. `/api/auth/mfa/verificar` recibe `{ "challengeId": "...", "code": "042817" }`; el código vence en cinco minutos, admite cinco intentos y el reenvío espera un minuto (máximo cinco reenvíos). El reto, hash del código, expiración, intentos y estado se almacenan en `retos_mfa`; el código original nunca se persiste. Solo tras verificarlo se emiten access/refresh tokens con la marca MFA. Los JWT y refresh tokens anteriores a esta implementación deben volver a autenticarse.

La migración crea `retos_mfa` con `reto_id`, `usuario_id`, `codigo_hash`, `estado`, `intentos`, `reenvios`, `creado_en`, `enviado_en` y `expira_en`; también agrega `mfa_verificado_en` a `refresh_tokens`. No se necesitan columnas nuevas en `usuarios`.

Configura `N8N_CHAT_WEBHOOK_URL` y `N8N_PAYMENT_WEBHOOK_URL` en el `.env` del backend. Ambos deben ser URLs de webhook del servidor n8n; nunca deben colocarse en el frontend. Si los webhooks están vacíos, las rutas responden `503` y no presentan el pago como exitoso. `N8N_API_TOKEN`, si se define, se envía como token Bearer al workflow.

El webhook de atención recibe `{ mensaje, conversacionId, idioma }` y debe devolver una respuesta JSON con `respuesta`, `answer` u `output`.

El webhook de pagos recibe un intento en el entorno indicado por `N8N_PAYMENT_ENVIRONMENT`, con cliente, dirección, productos comprobados contra el inventario, importe recalculado desde la base de datos y el email destinatario. Debe devolver `{ "estado": "aprobado|rechazado|pendiente", "referencia": "..." }`. Configura el workflow para simular explícitamente los tres resultados cuando el entorno sea `sandbox`, y para enviar el recibo a `destinatarioAdministrador` solo cuando su nodo de simulación/proveedor haya confirmado la aprobación. El endpoint no transmite números de tarjeta ni CVV; estos datos no deben enviarse a n8n. Esta conexión por sí sola no constituye una pasarela de producción ni realiza cobros reales.

Después de configurar los workflows, prueba el chatbot y cada resultado de sandbox antes de habilitar pagos. La aplicación no puede certificar el envío SMTP ni la creación de nodos dentro de n8n sin las URLs y credenciales de ese servicio.

## 7. Nota de seguridad

Los campos privados (nombre del funcionario, correo, teléfono, dirección) y el dato sensible (antecedentes) se guardan cifrados con AES-256-GCM usando `CRYPTO_KEY`. Si pierdes esa clave, los datos cifrados ya guardados no se podrán volver a leer — guárdala en un lugar seguro, separada del código.
