function gardeInProgressExistsSql(pharmacyAlias = "p") {
  return `EXISTS (
    SELECT 1 FROM planning_garde pg
    WHERE pg.id_pharmacie = ${pharmacyAlias}.id
      AND pg.est_actif = 1
      AND pg.date_debut <= NOW()
      AND pg.date_fin >= NOW()
  )`;
}

/** Ouverte selon horaires_normaux / exceptions (jour même). Sans horaires → fermé. */
const { isOpenByWeekRow } = require("./weeklyPharmacyHours");
const { pharmacyOpenByScheduleSql } = require("./pharmacyHorairesDb");

function pharmacyEffectiveOpenSelectSql() {
  return `(${pharmacyOpenByScheduleSql("p")}) AS est_ouverte`;
}

/** Accessible : ouverte (horaires) ou de garde en cours. */
function pharmacyCountsAsOpenSql() {
  return `(${pharmacyOpenByScheduleSql("p")} OR ${gardeInProgressExistsSql("p")})`;
}

function parseScheduleMinutes(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function isOpenByScheduleRow(row, date = new Date()) {
  const byWeek = isOpenByWeekRow(row, date);
  if (byWeek !== null) return byWeek;

  return null;
}

function applyEffectiveOpenToRow(row) {
  if (!row) return row;
  const garde = !!row.est_de_garde;
  const bySchedule = isOpenByScheduleRow(row);
  if (garde) {
    row.est_ouverte = true;
  } else if (bySchedule !== null) {
    row.est_ouverte = bySchedule;
  } else {
    row.est_ouverte = false;
  }
  return row;
}

module.exports = {
  pharmacyOpenByScheduleSql,
  pharmacyEffectiveOpenSelectSql,
  pharmacyCountsAsOpenSql,
  isOpenByScheduleRow,
  applyEffectiveOpenToRow,
};
