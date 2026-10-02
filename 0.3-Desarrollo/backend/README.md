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
| POST | `/api/atencion/calificacion` | Registrar calificación del chatbot |
| POST | `/api/atencion/mensaje` | Proxy del chatbot al workflow de n8n |
| POST | `/api/pagos/procesar` | Verificar una solicitud de pago mediante n8n (requiere sesión) |
| GET | `/api/reportes/mensual` | Reporte mensual (A, B, C) |

## Integraciones n8n

Configura `N8N_CHAT_WEBHOOK_URL` y `N8N_PAYMENT_WEBHOOK_URL` en el `.env` del backend. Ambos deben ser URLs de webhook del servidor n8n; nunca deben colocarse en el frontend. Si los webhooks están vacíos, las rutas responden `503` y no presentan el pago como exitoso. `N8N_API_TOKEN`, si se define, se envía como token Bearer al workflow.

El webhook de atención recibe `{ mensaje, conversacionId, idioma }` y debe devolver una respuesta JSON con `respuesta`, `answer` u `output`.

El webhook de pagos recibe un intento en el entorno indicado por `N8N_PAYMENT_ENVIRONMENT`, con cliente, dirección, productos comprobados contra el inventario, importe recalculado desde la base de datos y el email destinatario. Debe devolver `{ "estado": "aprobado|rechazado|pendiente", "referencia": "..." }`. Configura el workflow para simular explícitamente los tres resultados cuando el entorno sea `sandbox`, y para enviar el recibo a `destinatarioAdministrador` solo cuando su nodo de simulación/proveedor haya confirmado la aprobación. El endpoint no transmite números de tarjeta ni CVV; estos datos no deben enviarse a n8n. Esta conexión por sí sola no constituye una pasarela de producción ni realiza cobros reales.

Después de configurar los workflows, prueba el chatbot y cada resultado de sandbox antes de habilitar pagos. La aplicación no puede certificar el envío SMTP ni la creación de nodos dentro de n8n sin las URLs y credenciales de ese servicio.

## 7. Nota de seguridad

Los campos privados (nombre del funcionario, correo, teléfono, dirección) y el dato sensible (antecedentes) se guardan cifrados con AES-256-GCM usando `CRYPTO_KEY`. Si pierdes esa clave, los datos cifrados ya guardados no se podrán volver a leer — guárdala en un lugar seguro, separada del código.
