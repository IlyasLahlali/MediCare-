const pool = require("../config/db");
const { getOwnedPharmacy } = require("./pharmacienHelper");
const {
  notifyGardeActivated,
  notifyEndedGardePlannings,
  notifyGardeCancelled,
} = require("./pharmaNotificationService");

function toMysqlDatetime(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const local = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?/);
    if (local) return `${local[1]} ${local[2]}:00`;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function isPlanningInProgress(planning) {
  if (!planning?.date_debut || !planning?.date_fin) return false;
  const now = Date.now();
  return (
    now >= new Date(planning.date_debut).getTime() &&
    now <= new Date(planning.date_fin).getTime()
  );
}

/** Planning encore éditable (actif, pas encore terminé). */
async function getActivePlanning(pharmacyId) {
  try {
    const [rows] = await pool.query(
      `SELECT id, date_debut, date_fin, est_actif
       FROM planning_garde
       WHERE id_pharmacie = ? AND est_actif = true AND date_fin >= NOW()
       ORDER BY date_debut DESC
       LIMIT 1`,
      [pharmacyId]
    );
    return rows[0] || null;
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return null;
    throw err;
  }
}

/** Aligne pharmacies.est_de_garde sur la période réelle (évite « de garde » après la fin). */
async function syncGardeFlagsFromPlanning(pharmacyId = null) {
  try {
    await notifyEndedGardePlannings(pharmacyId);

    const scope = pharmacyId ? "AND p.id = ?" : "";
    const params = pharmacyId ? [pharmacyId] : [];

    await pool.query(
      `UPDATE planning_garde SET est_actif = false
       WHERE est_actif = true AND date_fin < NOW()
       ${pharmacyId ? "AND id_pharmacie = ?" : ""}`,
      pharmacyId ? [pharmacyId] : []
    );

    await pool.query(
      `UPDATE pharmacies p
       SET p.est_de_garde = false
       WHERE p.est_de_garde = true ${scope}
       AND NOT EXISTS (
         SELECT 1 FROM planning_garde pg
         WHERE pg.id_pharmacie = p.id
           AND pg.est_actif = 1
           AND pg.date_debut <= NOW()
           AND pg.date_fin >= NOW()
       )`,
      params
    );

    await pool.query(
      `UPDATE pharmacies p
       INNER JOIN planning_garde pg ON pg.id_pharmacie = p.id
       SET p.est_de_garde = true, p.est_ouverte = true
       WHERE pg.est_actif = 1
         AND pg.date_debut <= NOW()
         AND pg.date_fin >= NOW()
         ${scope}`,
      params
    );
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return;
    throw err;
  }
}

async function activateGarde(pharmacyId, userId, { date_debut, date_fin } = {}) {
  const pharmacy = await getOwnedPharmacy(pharmacyId, userId);
  if (!pharmacy) return null;

  const debut = toMysqlDatetime(date_debut) || toMysqlDatetime(new Date());
  const fin =
    toMysqlDatetime(date_fin) ||
    toMysqlDatetime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  if (new Date(fin) <= new Date(debut)) {
    throw new Error("La date de fin doit être après la date de début");
  }

  let planningId = null;
  try {
    await pool.query(
      `UPDATE planning_garde SET est_actif = false WHERE id_pharmacie = ? AND est_actif = true`,
      [pharmacyId]
    );
    const [insert] = await pool.query(
      `INSERT INTO planning_garde (id_pharmacie, date_debut, date_fin, est_actif)
       VALUES (?, ?, ?, true)`,
      [pharmacyId, debut, fin]
    );
    planningId = insert.insertId;
  } catch (err) {
    if (err.code !== "ER_NO_SUCH_TABLE") throw err;
  }

  try {
    await notifyGardeActivated(pharmacyId, userId, pharmacy.nom, fin, planningId);
  } catch (e) {
    console.error("Notification garde:", e.message);
  }

  await syncGardeFlagsFromPlanning(pharmacyId);
  const planning = await getActivePlanning(pharmacyId);
  const inProgress = isPlanningInProgress(planning);

  return {
    est_de_garde: inProgress,
    date_debut: debut,
    date_fin: fin,
    updated: inProgress,
  };
}

async function deactivateGarde(pharmacyId, userId) {
  const pharmacy = await getOwnedPharmacy(pharmacyId, userId);
  if (!pharmacy) return null;

  const planning = await getActivePlanning(pharmacyId);

  try {
    await pool.query(
      `UPDATE planning_garde
       SET est_actif = false, date_fin = IF(date_fin > NOW(), NOW(), date_fin)
       WHERE id_pharmacie = ? AND est_actif = true`,
      [pharmacyId]
    );
  } catch (err) {
    if (err.code !== "ER_NO_SUCH_TABLE") throw err;
  }

  if (planning?.id) {
    try {
      await notifyGardeCancelled(pharmacyId, userId, pharmacy.nom, planning.id);
    } catch (e) {
      console.error("Notification garde annulée:", e.message);
    }
  }

  await syncGardeFlagsFromPlanning(pharmacyId);

  return { est_de_garde: false };
}

async function getGardeSummaryForUser(userId, ownerCol) {
  const [pharmacies] = await pool.query(
    `SELECT id, nom, est_de_garde, est_ouverte, est_active
     FROM pharmacies WHERE ${ownerCol} = ?
     ORDER BY nom`,
    [userId]
  );

  const result = [];
  for (const p of pharmacies) {
    const planning = await getActivePlanning(p.id);
    const inProgress = isPlanningInProgress(planning);
    result.push({
      id: p.id,
      nom: p.nom,
      est_de_garde: inProgress,
      est_ouverte: !!p.est_ouverte,
      est_active: !!p.est_active,
      planning: planning
        ? {
            id: planning.id,
            date_debut: planning.date_debut,
            date_fin: planning.date_fin,
          }
        : null,
    });
  }
  return result;
}

module.exports = {
  activateGarde,
  deactivateGarde,
  getActivePlanning,
  getGardeSummaryForUser,
  syncGardeFlagsFromPlanning,
  isPlanningInProgress,
};
