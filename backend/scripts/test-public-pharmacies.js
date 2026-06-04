require("dotenv").config();
const pool = require("../config/db");
const { loadPharmacySchema, getPharmacySchema } = require("../utils/pharmacySchema");
const { ensurePharmacyHorairesTablesSchema } = require("../utils/pharmacyHorairesDb");
const { getPublicPharmacySql, haversineKmSql } = require("../utils/publicPharmacy");
const {
  gardePlanningSelectSql,
  gardeEffectiveSelectSql,
} = require("../utils/gardePublicSql");
const {
  pharmacyEffectiveOpenSelectSql,
  pharmacyCountsAsOpenSql,
} = require("../utils/pharmacyHours");

async function main() {
  await loadPharmacySchema();
  await ensurePharmacyHorairesTablesSchema();
  const s = getPharmacySchema();
  let sql = `
    SELECT p.id, p.nom,
           ${pharmacyEffectiveOpenSelectSql()},
           ${gardeEffectiveSelectSql()},
           ${gardePlanningSelectSql()}
    FROM pharmacies p
    WHERE ${getPublicPharmacySql()}
    ORDER BY p.est_de_garde DESC, p.est_ouverte DESC, p.nom
    LIMIT 5`;
  try {
    const [rows] = await pool.query(sql);
    console.log("OK rows:", rows.length, rows[0]?.nom);
  } catch (e) {
    console.error("LIST FAIL:", e.code, e.message);
  }

  try {
    const [[c]] = await pool.query(
      `SELECT COUNT(*) AS n FROM pharmacies p WHERE ${getPublicPharmacySql()} AND ${pharmacyCountsAsOpenSql()}`
    );
    console.log("COUNT ouvertes OK:", c?.n);
  } catch (e) {
    console.error("COUNT FAIL:", e.code, e.message);
  }

  const tables = ["horaires_normaux", "horaires_exceptionnels"];
  for (const t of tables) {
    const [r] = await pool.query(
      `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [t]
    );
    console.log(t, r.length ? "exists" : "MISSING");
  }

  const legacy = ["heure_ouverture", "heure_fermeture", "horaires_semaine"];
  for (const col of legacy) {
    const [r] = await pool.query(
      `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pharmacies' AND COLUMN_NAME = ?`,
      [col]
    );
    console.log("pharmacies." + col, r.length ? "still there" : "dropped");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
