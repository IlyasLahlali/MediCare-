function gardeInProgressExistsSql(pharmacyAlias = "p") {
  return `EXISTS (
    SELECT 1 FROM planning_garde pg
    WHERE pg.id_pharmacie = ${pharmacyAlias}.id
      AND pg.est_actif = 1
      AND pg.date_debut <= NOW()
      AND pg.date_fin >= NOW()
  )`;
}

/**
 * Ouverte selon heure_ouverture / heure_fermeture (jour même).
 * Sans horaires → repli sur est_ouverte (manuel pharmacien).
 */
function pharmacyOpenByScheduleSql(alias = "p") {
  const a = alias;
  return `(CASE
    WHEN ${a}.heure_ouverture IS NOT NULL AND ${a}.heure_fermeture IS NOT NULL THEN
      (CASE
        WHEN ${a}.heure_ouverture < ${a}.heure_fermeture THEN
          (CURTIME() >= ${a}.heure_ouverture AND CURTIME() < ${a}.heure_fermeture)
        ELSE
          (CURTIME() >= ${a}.heure_ouverture OR CURTIME() < ${a}.heure_fermeture)
      END)
    ELSE IFNULL(${a}.est_ouverte, 0)
  END)`;
}

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
  const openM = parseScheduleMinutes(row.heure_ouverture);
  const closeM = parseScheduleMinutes(row.heure_fermeture);
  if (openM == null || closeM == null) return null;
  const nowM = date.getHours() * 60 + date.getMinutes();
  if (openM < closeM) return nowM >= openM && nowM < closeM;
  return nowM >= openM || nowM < closeM;
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
    row.est_ouverte = !!row.est_ouverte;
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
