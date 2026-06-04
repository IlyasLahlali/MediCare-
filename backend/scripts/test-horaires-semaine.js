require("dotenv").config();
const pool = require("../config/db");
const { parseWeekSchedule, serializeWeek } = require("../utils/weeklyPharmacyHours");

(async () => {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pharmacies' AND COLUMN_NAME = 'horaires_semaine'`
  );
  console.log("column exists:", cols.length > 0);

  const [rows] = await pool.query("SELECT id, horaires_semaine FROM pharmacies LIMIT 1");
  const id = rows[0]?.id;
  if (!id) {
    console.log("no pharmacy");
    process.exit(0);
  }

  const week = parseWeekSchedule({
    lundi: { closed: true, open: null, close: null },
    mardi: { closed: false, open: "09:00", close: "17:00" },
    mercredi: { closed: false, open: "09:00", close: "17:00" },
    jeudi: { closed: false, open: "09:00", close: "17:00" },
    vendredi: { closed: false, open: "09:00", close: "17:00" },
    samedi: { closed: false, open: "09:00", close: "17:00" },
    dimanche: { closed: false, open: "09:00", close: "17:00" },
  });
  const json = serializeWeek(week);
  await pool.query("UPDATE pharmacies SET horaires_semaine = ? WHERE id = ?", [json, id]);

  const [after] = await pool.query("SELECT horaires_semaine FROM pharmacies WHERE id = ?", [id]);
  const raw = after[0].horaires_semaine;
  console.log("stored type:", typeof raw, raw);
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  console.log("lundi.closed:", parsed?.lundi?.closed);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
