const pool = require("../config/db");
const { getPharmacySchema } = require("./pharmacySchema");
const { createNotification, hasRecentNotification } = require("./notificationHelper");

const MS_MIN = 60 * 1000;
const MS_HOUR = 60 * MS_MIN;

async function getPharmacyOwner(pharmacyId) {
  const s = getPharmacySchema();
  const [rows] = await pool.query(
    `SELECT p.id, p.nom, p.${s.ownerCol} AS owner_id FROM pharmacies p WHERE p.id = ?`,
    [pharmacyId]
  );
  return rows[0] || null;
}

function formatFrDateTime(dt) {
  return new Date(dt).toLocaleString("fr-MA", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function detailLink(pharmacyId) {
  return `/Pharmacien/html/pharmacieDetail.html?id=${pharmacyId}`;
}

function pharmacieListLink() {
  return "/Pharmacien/html/pharmacie.html";
}

async function notifyPharmacienPharmacyCreated(ownerId, pharmacyId, pharmacyName) {
  if (!ownerId) return;
  await createNotification({
    userId: ownerId,
    type: "SYSTEM",
    titre: "Pharmacie en attente",
    message: `« ${pharmacyName} » a été ajoutée. Validation MediCare+ en cours — vous serez notifié dès qu’elle sera publiée.`,
    lien: detailLink(pharmacyId),
  });
}

async function notifyPharmacienPharmacyUpdated(ownerId, pharmacyId, pharmacyName) {
  if (!ownerId) return;
  await createNotification({
    userId: ownerId,
    type: "SYSTEM",
    titre: "Pharmacie modifiée",
    message: `Les informations de « ${pharmacyName} » ont été enregistrées.`,
    lien: detailLink(pharmacyId),
  });
}

async function notifyPharmacienPharmacyDeleted(ownerId, pharmacyName) {
  if (!ownerId) return;
  await createNotification({
    userId: ownerId,
    type: "SYSTEM",
    titre: "Pharmacie supprimée",
    message: `« ${pharmacyName} » a été retirée de votre espace.`,
    lien: pharmacieListLink(),
  });
}

async function notifyPharmacienNewAvis(pharmacyId, { note, commentaire, isUpdate = false }) {
  const pharmacy = await getPharmacyOwner(pharmacyId);
  if (!pharmacy?.owner_id) return;

  const titre = isUpdate ? "Avis utilisateur modifié" : "Nouvel avis utilisateur";
  if (!isUpdate && (await hasRecentNotification(pharmacy.owner_id, titre, 1))) {
    return;
  }

  const excerpt = commentaire
    ? String(commentaire).trim().slice(0, 120) + (commentaire.length > 120 ? "…" : "")
    : "Sans commentaire";

  await createNotification({
    userId: pharmacy.owner_id,
    type: "AVIS",
    titre,
    message: `${pharmacy.nom} — note ${note}/5. « ${excerpt} »`,
    lien: detailLink(pharmacyId),
  });
}

async function notifyGardeActivated(pharmacyId, ownerId, pharmacyName, dateFin, planningId) {
  if (!ownerId) return;
  const titre = "Mode de garde activé";
  const tag = planningId
    ? `[p:${pharmacyId}:plan:${planningId}]`
    : `[p:${pharmacyId}:active:${Date.now()}]`;
  await createNotification({
    userId: ownerId,
    type: "GARDE",
    titre,
    message: `${tag} ${pharmacyName} est en mode de garde jusqu’au ${formatFrDateTime(dateFin)}.`,
    lien: detailLink(pharmacyId),
  });
}

async function hasGardeReminder(userId, planningId, kind, withinHours) {
  const tag =
    kind === "active"
      ? `[p:${planningId}:active]`
      : `[g:${planningId}:${kind}]`;
  try {
    const [rows] = await pool.query(
      `SELECT id FROM notifications
       WHERE id_utilisateur = ? AND message LIKE ?
         AND date_creation >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       LIMIT 1`,
      [userId, `%${tag}%`, withinHours]
    );
    return rows.length > 0;
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE" || err.code === "ER_BAD_FIELD_ERROR") return false;
    throw err;
  }
}

async function sendGardeReminder({ ownerId, pharmacyId, pharmacyName, planningId, kind, titre, body }) {
  if (await hasGardeReminder(ownerId, planningId, kind, kind.startsWith("fin") ? 48 : 24)) return;
  const tag = `[g:${planningId}:${kind}]`;
  await createNotification({
    userId: ownerId,
    type: "GARDE",
    titre,
    message: `${tag} ${body}`,
    lien: detailLink(pharmacyId),
  });
}

/** Notifications pour les gardes dont la date de fin est passée (avant désactivation du planning). */
async function notifyEndedGardePlannings(pharmacyId = null) {
  const s = getPharmacySchema();
  const scope = pharmacyId ? "AND pg.id_pharmacie = ?" : "";
  const params = pharmacyId ? [pharmacyId] : [];

  let rows = [];
  try {
    const [r] = await pool.query(
      `SELECT pg.id AS planning_id, pg.date_fin,
              p.id AS pharmacy_id, p.nom AS pharmacy_nom, p.${s.ownerCol} AS owner_id
       FROM planning_garde pg
       INNER JOIN pharmacies p ON p.id = pg.id_pharmacie
       WHERE pg.est_actif = true AND pg.date_fin < NOW()
       ${scope}`,
      params
    );
    rows = r;
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return;
    throw err;
  }

  for (const row of rows) {
    if (!row.owner_id) continue;
    await sendGardeReminder({
      ownerId: row.owner_id,
      pharmacyId: row.pharmacy_id,
      pharmacyName: row.pharmacy_nom,
      planningId: row.planning_id,
      kind: "fin-now",
      titre: "Garde terminée",
      body: `La période de garde est terminée pour ${row.pharmacy_nom}. Elle n'est plus affichée comme « de garde » sur MediCare+.`,
    });
  }
}

async function notifyGardeCancelled(pharmacyId, ownerId, pharmacyName, planningId) {
  if (!ownerId || !planningId) return;
  await sendGardeReminder({
    ownerId,
    pharmacyId,
    pharmacyName,
    planningId,
    kind: "fin-manual",
    titre: "Garde terminée",
    body: `La garde de ${pharmacyName} est terminée. Elle n’est plus affichée comme « de garde » sur MediCare+.`,
  });
}

async function runGardeReminders() {
  const s = getPharmacySchema();
  let rows = [];
  try {
    const [r] = await pool.query(
      `SELECT pg.id AS planning_id, pg.date_debut, pg.date_fin,
              p.id AS pharmacy_id, p.nom AS pharmacy_nom, p.${s.ownerCol} AS owner_id
       FROM planning_garde pg
       INNER JOIN pharmacies p ON p.id = pg.id_pharmacie
       WHERE pg.est_actif = true AND pg.date_fin >= NOW()`
    );
    rows = r;
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return;
    throw err;
  }

  const now = Date.now();

  for (const row of rows) {
    const ownerId = row.owner_id;
    if (!ownerId) continue;

    const debut = new Date(row.date_debut).getTime();
    const fin = new Date(row.date_fin).getTime();
    const pid = row.pharmacy_id;
    const plid = row.planning_id;
    const name = row.pharmacy_nom;

    const inBand = (target, lowMs, highMs) => target >= now + lowMs && target <= now + highMs;

    if (inBand(debut, 55 * MS_MIN, 65 * MS_MIN)) {
      await sendGardeReminder({
        ownerId,
        pharmacyId: pid,
        pharmacyName: name,
        planningId: plid,
        kind: "debut-1h",
        titre: "Votre garde commence dans 1 heure",
        body: `${name} — début à ${formatFrDateTime(row.date_debut)}.`,
      });
    }

    if (inBand(debut, -5 * MS_MIN, 5 * MS_MIN)) {
      await sendGardeReminder({
        ownerId,
        pharmacyId: pid,
        pharmacyName: name,
        planningId: plid,
        kind: "debut-now",
        titre: "Votre garde commence maintenant",
        body: `Le mode de garde est actif pour ${name}.`,
      });
    }

    if (inBand(fin, 55 * MS_MIN, 65 * MS_MIN)) {
      await sendGardeReminder({
        ownerId,
        pharmacyId: pid,
        pharmacyName: name,
        planningId: plid,
        kind: "fin-1h",
        titre: "Votre garde se termine dans 1 heure",
        body: `${name} — fin à ${formatFrDateTime(row.date_fin)}.`,
      });
    }

    if (inBand(fin, -5 * MS_MIN, 5 * MS_MIN)) {
      await sendGardeReminder({
        ownerId,
        pharmacyId: pid,
        pharmacyName: name,
        planningId: plid,
        kind: "fin-now",
        titre: "Garde terminée",
        body: `La période de garde est terminée pour ${name}.`,
      });
    }
  }
}

module.exports = {
  notifyPharmacienNewAvis,
  notifyPharmacienPharmacyCreated,
  notifyPharmacienPharmacyUpdated,
  notifyPharmacienPharmacyDeleted,
  notifyGardeActivated,
  notifyEndedGardePlannings,
  notifyGardeCancelled,
  runGardeReminders,
  getPharmacyOwner,
};
