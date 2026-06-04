const pool = require("../config/db");
const { invalidatePharmacySchemaCache } = require("./pharmacySchema");

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function ensurePharmacyStatutAdminSchema() {
  if (!(await columnExists("pharmacies", "statut_admin"))) {
    const after = (await columnExists("pharmacies", "est_active")) ? "AFTER est_active" : "";
    await pool.query(`
      ALTER TABLE pharmacies
        ADD COLUMN statut_admin ENUM('en_attente', 'valide', 'refuse') NOT NULL DEFAULT 'en_attente'
        ${after}
    `);
    console.log("Migration : colonne pharmacies.statut_admin créée.");
  }

  if (await columnExists("pharmacies", "est_active")) {
    await pool.query(`
      UPDATE pharmacies
      SET statut_admin = CASE
        WHEN est_active = 1 AND (statut_admin IS NULL OR statut_admin = 'en_attente') THEN 'valide'
        WHEN est_active = 0 AND statut_admin = 'valide' THEN 'en_attente'
        ELSE statut_admin
      END
    `);
    await pool.query(`ALTER TABLE pharmacies DROP COLUMN est_active`);
    console.log("Migration : colonne pharmacies.est_active supprimée.");
  }

  await pool.query(
    `UPDATE utilisateurs SET statut = 'VALIDE' WHERE role = 'PHARMACIEN' AND statut = 'EN_ATTENTE'`
  );
  await pool.query(
    `UPDATE utilisateurs SET statut = 'VALIDE' WHERE role IN ('UTILISATEUR', 'ADMIN')`
  );

  invalidatePharmacySchemaCache();
}

let schemaReady = null;

function ensurePharmacyStatutAdminSchemaOnce() {
  if (!schemaReady) {
    schemaReady = ensurePharmacyStatutAdminSchema().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

module.exports = {
  ensurePharmacyStatutAdminSchema,
  ensurePharmacyStatutAdminSchemaOnce,
};
