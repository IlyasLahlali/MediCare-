require("dotenv").config();
const pool = require("../config/db");
const {
  parseWeekSchedule,
  serializeWeek,
  validateWeek,
  legacyTimesFromWeek,
} = require("../utils/weeklyPharmacyHours");

const body = {
  horaires_semaine: {
    lundi: { closed: true, open: null, close: null },
    mardi: { closed: false, open: "09:00", close: "17:00" },
    mercredi: { closed: false, open: "09:00", close: "17:00" },
    jeudi: { closed: false, open: "09:00", close: "17:00" },
    vendredi: { closed: false, open: "09:00", close: "17:00" },
    samedi: { closed: false, open: "09:00", close: "17:00" },
    dimanche: { closed: false, open: "09:00", close: "17:00" },
  },
};

(async () => {
  const week = parseWeekSchedule(body.horaires_semaine);
  console.log("parse ok:", validateWeek(week));
  const json = serializeWeek(week);
  const legacy = legacyTimesFromWeek(week);
  const [rows] = await pool.query("SELECT id FROM pharmacies LIMIT 1");
  const id = rows[0].id;
  await pool.query(
    "UPDATE pharmacies SET horaires_semaine = ?, heure_ouverture = ?, heure_fermeture = ? WHERE id = ?",
    [json, legacy.heure_ouverture, legacy.heure_fermeture, id]
  );
  const [after] = await pool.query(
    "SELECT horaires_semaine, heure_ouverture, heure_fermeture FROM pharmacies WHERE id = ?",
    [id]
  );
  console.log("after:", after[0]);
  const reparsed = parseWeekSchedule(after[0].horaires_semaine);
  console.log("lundi after parse:", reparsed.lundi);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
