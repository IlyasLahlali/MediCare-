/**
 * Ajoute google_id et autorise mot_de_passe NULL (comptes Google uniquement).
 * Usage : node scripts/runMigrationGoogleAuth.js
 */
require("dotenv").config();
const pool = require("../config/db");

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function main() {
  if (!(await columnExists("utilisateurs", "google_id"))) {
    await pool.query(
      `ALTER TABLE utilisateurs ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER email`
    );
    console.log("Colonne google_id ajoutée.");
  } else {
    console.log("Colonne google_id déjà présente.");
  }

  await pool.query(`ALTER TABLE utilisateurs MODIFY mot_de_passe VARCHAR(255) NULL`);
  console.log("mot_de_passe peut être NULL (comptes Google).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
