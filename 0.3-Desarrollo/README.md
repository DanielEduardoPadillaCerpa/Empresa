# Suite Institucional — Suministros para comisaría policial

Proyecto completo: sitio web (Bootstrap 5) + backend (Node.js/Express) + MySQL (Clever Cloud).
Pensado para trabajarse en VS Code, sin dependencias de Java/Spring Boot.

## Estructura

```
suite-institucional/
├── frontend/     -> HTML/CSS/JS estático (ábrelo directo en el navegador o con Live Server)
└── backend/      -> API en Node.js + Express (ver backend/README.md para instrucciones)
```

## Cómo correrlo

1. **Backend primero:**
   ```bash
   cd backend
   npm install
   cp .env.example .env      # completa DB_PASSWORD, CRYPTO_KEY y JWT_SECRET
   npm start
   ```
   Debe quedar corriendo en `http://localhost:8080`.

2. **Frontend:**
   Abre `frontend/landing.html` en el navegador — esa es la página de entrada del sitio
   (o usa la extensión "Live Server" de VS Code para recargar automático).

## Flujo de navegación

```
landing.html  →  index.html (catálogo)  →  agregar productos al carrito
                                          →  intentar "Continuar con el registro"
                                          →  ¿hay sesión activa?
                                              NO  → login.html (o registro.html si no tiene cuenta)
                                              SÍ  → registro.html (checkout / registro de cliente)
```

## Qué hace cada página del frontend

| Página | Función |
|---|---|
| `landing.html` | Página de aterrizaje / entrada principal del sitio |
| `login.html` | Inicio de sesión — obligatorio antes de completar una compra |
| `index.html` | Catálogo con carrito de compras (localStorage), selector de idioma y chatbot |
| `registro.html` | Registro de cliente (clasificación de datos Ley 1581) + creación de la cuenta de acceso (correo/contraseña) |
| `admin-clientes.html` | Lista los clientes registrados, leyendo `GET /api/clientes` |
| `reportes.html` | Panel con métricas de atención (KPIs de ejemplo + Chart.js) |

## Autenticación

- El registro de cliente (`registro.html`) crea, en el mismo formulario, una cuenta de acceso (correo + contraseña) y hace login automático.
- El botón "Continuar con el registro" en el carrito exige sesión activa: si no la hay, redirige a `login.html` y, tras iniciar sesión, vuelve automáticamente a donde el cliente iba.
- La sesión se guarda como un JWT en `localStorage`, válido por 2 horas.
- Las contraseñas se guardan con hash `bcrypt` — nunca en texto plano.

## Notas de seguridad

- Regenera la contraseña de la base de datos de Clever Cloud si la compartiste en algún momento por captura de pantalla o chat.
- Cambia `JWT_SECRET` y `CRYPTO_KEY` en tu `.env` por valores propios — nunca dejes los de ejemplo.
- El archivo `.env` del backend nunca debe subirse a un repositorio público.
- Los campos privados y sensibles se cifran con AES-256-GCM antes de guardarse (ver `backend/src/crypto.js`).
