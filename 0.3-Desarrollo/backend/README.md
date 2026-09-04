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

El archivo `.env` **no se sube a ningún repositorio** — ya está pensado para quedarse solo en tu máquina.

## 4. Ejecutar

```bash
npm start
```

Deberías ver en la terminal:
```
[db] Tablas verificadas/creadas correctamente.
[server] Backend corriendo en http://localhost:8080
```

Las tablas (`clientes`, `datos_sensibles`, `atenciones`) se crean automáticamente la primera vez que arranca — no necesitas ejecutar ningún script SQL a mano.

## 5. Probar

Abre en el navegador: `http://localhost:8080/api/clientes` → deberías ver `[]` (lista vacía) si aún no has registrado a nadie.

Con el backend corriendo, abre `frontend/registro.html` en el navegador, llena el formulario y dale a "Registrar cliente". Luego revisa `frontend/admin-clientes.html` para verlo listado.

## 6. Endpoints disponibles

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/clientes` | Lista todos los clientes |
| GET | `/api/clientes/:id` | Ver un cliente |
| POST | `/api/clientes` | Registrar cliente |
| POST | `/api/clientes/:id/dato-sensible` | Registrar antecedentes judiciales (con consentimiento) |
| POST | `/api/atencion/calificacion` | Registrar calificación del chatbot |
| GET | `/api/reportes/mensual` | Reporte mensual (A, B, C) |

## 7. Nota de seguridad

Los campos privados (nombre del funcionario, correo, teléfono, dirección) y el dato sensible (antecedentes) se guardan cifrados con AES-256-GCM usando `CRYPTO_KEY`. Si pierdes esa clave, los datos cifrados ya guardados no se podrán volver a leer — guárdala en un lugar seguro, separada del código.
