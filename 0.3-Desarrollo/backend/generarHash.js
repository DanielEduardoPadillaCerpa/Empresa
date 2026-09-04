// Usa bcryptjs si bcrypt te da problemas en Windows
const bcrypt = require('bcryptjs');

async function run() {
  const password = "Admin123!"; // 👈 ESTA será tu contraseña real
  const hash = await bcrypt.hash(password, 12);
  console.log("Hash generado:", hash);
}

run();
