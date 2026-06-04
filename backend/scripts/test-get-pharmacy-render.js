require("dotenv").config();
const pool = require("../config/db");
const { attachHorairesSemaineToPharmacy } = require("../utils/weeklyPharmacyHours");

(async () => {
  const [rows] = await pool.query("SELECT * FROM pharmacies WHERE nom LIKE '%test%' OR nom = 'test' LIMIT 3");
  for (const row of rows) {
    attachHorairesSemaineToPharmacy(row);
    console.log("id", row.id, "nom", row.nom);
    console.log("horaires_semaine type", typeof row.horaires_semaine);
    try {
      JSON.stringify(row.horaires_semaine);
      console.log("JSON.stringify ok");
    } catch (e) {
      console.log("JSON.stringify FAIL", e.message);
    }
  }
  if (!rows.length) {
    const [all] = await pool.query("SELECT id, nom, horaires_semaine FROM pharmacies LIMIT 1");
    console.log("sample", all[0]);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
