require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const pool = require("../config/db");
const { loadPharmacySchema } = require("../utils/pharmacySchema");
const { getOwnedPharmacy } = require("../utils/pharmacienHelper");

(async () => {
  await loadPharmacySchema();
  const [ph] = await pool.query("SELECT id, id_pharmacien FROM pharmacies LIMIT 1");
  const [u] = await pool.query("SELECT id FROM utilisateurs WHERE role = 'PHARMACIEN' LIMIT 1");
  if (!ph.length || !u.length) {
    console.log("missing data");
    process.exit(0);
  }
  const id = ph[0].id;
  const userId = u[0].id;
  console.log("pharmacy", id, "owner", ph[0].id_pharmacien, "user", userId);

  const pharmacy = await getOwnedPharmacy(id, userId);
  console.log("owned", pharmacy ? pharmacy.nom : null);

  try {
    const [stats] = await pool.query(
      `SELECT type, COALESCE(SUM(total), 0) AS total
       FROM statistiques_pharmacie
       WHERE id_pharmacie = ? AND date_jour >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
       GROUP BY type`,
      [id]
    );
    console.log("stats ok", stats.length);
  } catch (e) {
    console.log("stats FAIL", e.code, e.message);
  }

  try {
    const [avis] = await pool.query(
      `SELECT ROUND(AVG(note), 1) AS note_moyenne, COUNT(*) AS nb_avis
       FROM avis_pharmacie WHERE id_pharmacie = ?`,
      [id]
    );
    console.log("avis ok", avis);
  } catch (e) {
    console.log("avis FAIL", e.code, e.message);
  }

  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
