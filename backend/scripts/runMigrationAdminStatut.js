require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
  });

  try {
    await conn.query(`
      ALTER TABLE pharmacies
        ADD COLUMN statut_admin ENUM('en_attente', 'valide', 'refuse') NOT NULL DEFAULT 'en_attente'
        AFTER est_active
    `);
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }

  await conn.query(`
    UPDATE pharmacies
    SET statut_admin = IF(est_active, 'valide', 'en_attente')
    WHERE statut_admin IS NULL OR statut_admin = 'en_attente'
  `);

  console.log("OK — colonne statut_admin prête.");
  await conn.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
