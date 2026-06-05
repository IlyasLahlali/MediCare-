const pool = require("../config/db");
const { createNotification } = require("./notificationHelper");

function adminPharmacyDetailLink(pharmacyId, backPath) {
  const back = backPath || "/Admin/html/pharmacie.html?statut=en_attente";
  return `/Admin/html/pharmacieDetail.html?id=${pharmacyId}&back=${encodeURIComponent(back)}`;
}

async function getAdminUserIds() {
  const [rows] = await pool.query(
    `SELECT id FROM utilisateurs WHERE role = 'ADMIN'`
  );
  return rows.map((r) => r.id);
}

/** Tous les admins : nouvelle pharmacie en attente de validation. */
async function notifyAdminsPharmacyPending(pharmacyId, pharmacyName, pharmacienNom) {
  const adminIds = await getAdminUserIds();
  if (!adminIds.length) return;

  const owner = pharmacienNom ? ` par ${pharmacienNom}` : "";
  const message = `« ${pharmacyName} » a été ajoutée${owner}. Validation requise.`;
  const lien = adminPharmacyDetailLink(pharmacyId);

  await Promise.all(
    adminIds.map((userId) =>
      createNotification({
        userId,
        type: "ALERT",
        titre: "Nouvelle pharmacie",
        message,
        lien,
      })
    )
  );
}

function resolveAdminUserId(user) {
  const id = Number(user?.id ?? user?.userId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Admin ayant validé : confirmation (titre distinct des notifs pharmacien). */
async function notifyAdminPharmacyValidated(adminId, pharmacyId, pharmacyName) {
  const userId = resolveAdminUserId({ id: adminId });
  if (!userId) {
    console.warn("notifyAdminPharmacyValidated: id admin invalide", adminId);
    return null;
  }
  return createNotification({
    userId,
    type: "SYSTEM",
    titre: "Validation enregistrée",
    message: `Vous avez validé « ${pharmacyName} ». Elle est visible sur MediCare+.`,
    lien: adminPharmacyDetailLink(pharmacyId, "/Admin/html/pharmacie.html?statut=valide"),
  });
}

/** Admin ayant refusé : confirmation. */
async function notifyAdminPharmacyRefused(adminId, pharmacyId, pharmacyName) {
  const userId = resolveAdminUserId({ id: adminId });
  if (!userId) {
    console.warn("notifyAdminPharmacyRefused: id admin invalide", adminId);
    return null;
  }
  return createNotification({
    userId,
    type: "SYSTEM",
    titre: "Refus enregistré",
    message: `Vous avez refusé « ${pharmacyName} ». Elle n’est pas publiée sur MediCare+.`,
    lien: adminPharmacyDetailLink(pharmacyId, "/Admin/html/pharmacie.html?statut=refuse"),
  });
}

module.exports = {
  notifyAdminsPharmacyPending,
  notifyAdminPharmacyValidated,
  notifyAdminPharmacyRefused,
};
