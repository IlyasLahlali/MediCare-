/** Le champ utilisateurs.statut ne concerne que les comptes PHARMACIEN (refus d'accès). */

function userStatutApplies(role) {
  return String(role || "").toUpperCase() === "PHARMACIEN";
}

function assertUserMayLogin(user) {
  if (!user) return;
  if (userStatutApplies(user.role) && user.statut === "REFUSE") {
    const err = new Error("Compte refusé par l'administrateur");
    err.status = 403;
    throw err;
  }
}

/** Réponse API / JWT : pas de statut pour Utilisateur ni Admin. */
function attachPublicUserStatut(user) {
  if (!user || typeof user !== "object") return user;
  const out = { ...user };
  if (!userStatutApplies(out.role)) {
    delete out.statut;
  }
  return out;
}

module.exports = {
  userStatutApplies,
  assertUserMayLogin,
  attachPublicUserStatut,
};
