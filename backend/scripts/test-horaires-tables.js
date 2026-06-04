require("dotenv").config();
const {
  attachPharmacyHoraires,
  saveNormalHours,
  fetchNormalHoursRows,
} = require("../utils/pharmacyHorairesDb");
const { parseWeekSchedule } = require("../utils/weeklyPharmacyHours");

const week = parseWeekSchedule({
  lundi: { closed: true, open: null, close: null },
  mardi: { closed: false, open: "10:00", close: "19:00" },
  mercredi: { closed: false, open: "09:00", close: "17:00" },
  jeudi: { closed: false, open: "09:00", close: "17:00" },
  vendredi: { closed: false, open: "09:00", close: "17:00" },
  samedi: { closed: false, open: "09:00", close: "17:00" },
  dimanche: { closed: false, open: "09:00", close: "17:00" },
});

(async () => {
  const id = 6;
  const saved = await saveNormalHours(id, week);
  console.log("save:", saved);
  const rows = await fetchNormalHoursRows(id);
  console.log("rows lundi:", rows.find((r) => r.jour === "lundi"));
  const p = await attachPharmacyHoraires({ id });
  console.log("API lundi:", p.horaires_semaine.lundi);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
