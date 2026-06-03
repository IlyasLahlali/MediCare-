/**
 * Crée la table statistiques_pharmacie si elle n'existe pas.
 * Usage : node scripts/runMigrationStats.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "Pharmacie_Garde",
    multipleStatements: true,
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS statistiques_pharmacie (
      id INT PRIMARY KEY AUTO_INCREMENT,
      id_pharmacie INT NOT NULL,
      type ENUM('VUE', 'APPEL', 'RECHERCHE') NOT NULL,
      date_jour DATE NOT NULL,
      total INT NOT NULL DEFAULT 0,
      UNIQUE(id_pharmacie, type, date_jour),
      FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE
    )
  `);

  const [rows] = await conn.query("SHOW TABLES LIKE 'statistiques_pharmacie'");
  console.log(rows.length ? "OK — table statistiques_pharmacie prête." : "Échec création table.");
  await conn.end();
}

main().catch((err) => {
  console.error("Erreur migration:", err.message);
  process.exit(1);
});
