require("dotenv").config();
const pool = require("../config/db");
const {
  parseWeekSchedule,
  serializeWeek,
  validateWeek,
  attachHorairesSemaineToPharmacy,
} = require("../utils/weeklyPharmacyHours");

const payload = {
  lundi: { closed: true, open: null, close: null },
  mardi: { closed: false, open: "10:00", close: "18:00" },
  mercredi: { closed: false, open: "09:00", close: "17:00" },
  jeudi: { closed: false, open: "09:00", close: "17:00" },
  vendredi: { closed: false, open: "09:00", close: "17:00" },
  samedi: { closed: false, open: "09:00", close: "17:00" },
  dimanche: { closed: false, open: "09:00", close: "17:00" },
};

(async () => {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pharmacies' AND COLUMN_NAME = 'horaires_semaine'`
  );
  console.log("Colonne horaires_semaine:", cols[0] || "ABSENTE");

  const [rows] = await pool.query("SELECT id, nom FROM pharmacies WHERE nom = 'test' LIMIT 1");
  const id = rows[0]?.id;
  if (!id) {
    console.log("Pharmacie test introuvable");
    process.exit(1);
  }

  const week = parseWeekSchedule(payload);
  console.log("parseWeekSchedule:", validateWeek(week));
  const jsonStr = serializeWeek(week);
  const jsonObj = week;

  await pool.query("UPDATE pharmacies SET horaires_semaine = ? WHERE id = ?", [jsonStr, id]);
  let [after] = await pool.query(
    `SELECT horaires_semaine,
            JSON_TYPE(horaires_semaine) AS jtype,
            JSON_EXTRACT(horaires_semaine, '$.lundi.closed') AS lundi_closed,
            JSON_EXTRACT(horaires_semaine, '$.mardi.open') AS mardi_open
     FROM pharmacies WHERE id = ?`,
    [id]
  );
  console.log("\nAprès UPDATE (string JSON):", after[0]);

  await pool.query("UPDATE pharmacies SET horaires_semaine = ? WHERE id = ?", [jsonObj, id]);
  [after] = await pool.query(
    `SELECT horaires_semaine,
            JSON_TYPE(horaires_semaine) AS jtype,
            JSON_EXTRACT(horaires_semaine, '$.lundi.closed') AS lundi_closed
     FROM pharmacies WHERE id = ?`,
    [id]
  );
  console.log("\nAprès UPDATE (objet JS):", after[0]);

  const row = (await pool.query("SELECT * FROM pharmacies WHERE id = ?", [id]))[0][0];
  console.log("\nType brut mysql2:", typeof row.horaires_semaine, Buffer.isBuffer(row.horaires_semaine));
  attachHorairesSemaineToPharmacy(row);
  console.log("Après attach API:", row.horaires_semaine?.lundi);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
