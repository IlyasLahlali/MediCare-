const pool = require("../config/db");

let ensured = false;

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function ensureGoogleAuthSchema() {
  if (ensured) return true;

  if (!(await columnExists("utilisateurs", "google_id"))) {
    await pool.query(
      `ALTER TABLE utilisateurs ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER email`
    );
    console.log("Migration : colonne utilisateurs.google_id ajoutée.");
  }

  try {
    await pool.query(`ALTER TABLE utilisateurs MODIFY mot_de_passe VARCHAR(255) NULL`);
  } catch (err) {
    console.warn("utilisateurs.mot_de_passe NULL:", err.message);
  }

  ensured = true;
  return true;
}

module.exports = { ensureGoogleAuthSchema };
