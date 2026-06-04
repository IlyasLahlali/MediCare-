require("dotenv").config();
const pool = require("../config/db");
const { attachHorairesSemaineToPharmacy, parseWeekSchedule } = require("../utils/weeklyPharmacyHours");

(async () => {
  const [rows] = await pool.query(
    `SELECT id, nom, horaires_semaine,
            JSON_EXTRACT(horaires_semaine, '$.lundi.closed') AS lundi_closed
     FROM pharmacies WHERE nom = 'test'`
  );
  console.log("DB:", rows[0]);
  const row = rows[0];
  attachHorairesSemaineToPharmacy(row);
  console.log("API lundi:", row.horaires_semaine?.lundi);
  console.log("parse direct:", parseWeekSchedule(rows[0].horaires_semaine)?.lundi);
  process.exit(0);
})();
