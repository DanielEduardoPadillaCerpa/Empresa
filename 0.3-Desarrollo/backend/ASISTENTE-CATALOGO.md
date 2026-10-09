# Asistente del catalogo

## Datos y respuestas

El asistente usa `src/assistant/` y mantiene en memoria un indice de productos activos, categorias y FAQ publicadas. Se carga al arrancar y se actualiza cada 60 segundos; las rutas de alta, edicion y eliminacion de productos invalidan el indice. Las reservas y liberaciones de inventario tambien lo invalidan despues de confirmar su transaccion. Los mensajes normales no consultan MySQL. El indice selecciona explicitamente los campos publicos del catalogo y transforma precios decimales a centavos con aritmetica entera.

La migracion crea `faq_asistente` y `asistente_pendientes` de forma idempotente. Las FAQ iniciales llevan `[COMPLETAR]` y se excluyen del indice. Son plantillas pendientes de aprobacion, no politicas publicadas. Antes de responder consultas de envio, pago, devolucion, horario, garantia o Habeas Data, un administrador debe completar cada respuesta con el texto aprobado por la empresa. No se inventaron condiciones comerciales o legales.

## API

- `POST /api/asistente/mensaje`: JSON `{ "mensaje": "...", "conversacionId": "...", "productoActualId": 123 }`. El mensaje es obligatorio y admite hasta 500 caracteres. Respuesta: `{ respuesta, tarjetas, sugerencias, escalar, origen, conversacionId }`.
- `GET /api/asistente/sugerencias`: devuelve FAQ completas y activas, o preguntas genericas sobre el catalogo.
- `POST /api/atencion/mensaje`: alias compatible, sin conexion a n8n.
- `POST /api/atencion/calificacion`: conserva el registro de calificaciones.
- `GET /api/asistente/pendientes/resumen-semanal`: entrega conteos agregados, sin texto de preguntas ni datos personales. Requiere `Authorization: Bearer <ASSISTANT_WEEKLY_SUMMARY_TOKEN>` de al menos 32 caracteres.

La consulta del estado de pedidos se reconoce dentro de `POST /api/asistente/mensaje`; exige JWT con MFA y filtra por el `clienteId` del token. Solo expone numero de pedido, estado y fecha; no devuelve direcciones ni datos personales. Sin pedidos propios, devuelve un resultado vacio.

El limite es de 20 mensajes por minuto por IP y se comparte con el alias de atencion. Las preguntas no resueltas se normalizan y se registran en `asistente_pendientes`; la respuesta nunca copia el texto recibido. Los escalamientos se encolan como W6 con identificador de conversacion validado, motivo y resumen generico. No se manda el mensaje original a n8n.

## n8n W6 y W7

Importa `../n8n/workflows/W6-asistente-escalado.json` y `../n8n/workflows/W7-resumen-preguntas-asistente.json`.

1. Para W6, configura una credencial HTTP Header Auth con `Authorization: Bearer <N8N_W6_ASSISTANT_ESCALATION_SECRET>`, credenciales SMTP y las variables seguras `N8N_W6_ASSISTANT_ESCALATION_SECRET`, `ADMIN_EMAIL` y `AUTOMATION_FROM_EMAIL` en el host n8n. El secreto W6 debe ser aleatorio, tener 32 caracteres o mas y no reutilizarse en W1/W3.
2. Habilita Raw Body en el Webhook W6. Para validar HMAC en su nodo Code, permite el modulo builtin `crypto` (`NODE_FUNCTION_ALLOW_BUILTIN=crypto`) y el acceso a la variable del secreto conforme a la politica de secretos del host. El workflow comprueba firma y timestamp con tolerancia de 5 minutos antes de enviar el aviso.
3. Para W7, configura `ASSISTANT_WEEKLY_SUMMARY_URL` con la URL HTTPS completa del endpoint y `ASSISTANT_WEEKLY_SUMMARY_TOKEN` igual en n8n y backend. Configura el SMTP y el correo administrativo.
4. Mantiene la ejecucion de n8n tras proxy HTTPS. Desactiva el guardado de ejecuciones exitosas y conserva credenciales fuera de los JSON exportados. Activa los workflows solo despues de validar credenciales, webhook y correo.

La compra, la respuesta del catalogo y el registro de pendientes no dependen de que n8n responda; el worker reintenta las notificaciones de la outbox.

## Frontend

Sirve `frontend/` desde un origen HTTP y agrega ese origen exacto a `CORS_ORIGINS`; no abras el HTML con `file://`. En desarrollo se permiten `localhost` y `127.0.0.1` en el puerto 5500. En produccion la variable `CORS_ORIGINS` es obligatoria. Define `TRUST_PROXY_HOPS` con el numero real de proxies confiables (por ejemplo `1` si hay un proxy delante) para que los limites por IP funcionen sin aceptar IPs reenviadas arbitrarias. El widget consume `API_BASE`, crea mensajes y tarjetas con APIs DOM seguras, mantiene hasta 30 mensajes en `sessionStorage`, permite teclado y muestra un indicador de escritura.

## Modo local opcional

`ASSISTANT_MODE=rules` es el modo predeterminado. `ASSISTANT_MODE=llm` habilita `src/assistant/llmAdapter.js`, que solo convierte la pregunta en un JSON de intencion/filtros validado por Zod. Requiere `OLLAMA_URL=http://localhost:11434` y `OLLAMA_MODEL`; no puede enviar la consulta a una URL publica. El motor vuelve a reglas si Ollama falla, excede 8 segundos o produce JSON no valido. Las respuestas factuales siempre se redactan desde el indice y plantillas.

No se recomienda activar LLM hasta comparar contra las mismas 40 preguntas, demostrar mejor precision que reglas y mantener la latencia bajo 6 segundos en el servidor final. Como estimacion inicial para un modelo cuantizado pequeno: CPU de 4 nucleos y 8 GB RAM; 16 GB RAM o GPU con 4 GB VRAM suele mejorar latencia, pero debe medirse localmente.

## Validacion

Desde la raiz del repositorio:

```powershell
Set-Location .\0.3-Desarrollo\backend
npm test
```

`npm run test:assistant` ejecuta Jest + Supertest con catalogo inyectado, 40 preguntas y pruebas de seguridad/performance, mas una prueba DOM del widget. `npm run test:legacy` conserva la suite previa de `node:test`.
