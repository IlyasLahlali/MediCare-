const jwt = require("jsonwebtoken");
const { userStatutApplies, attachPublicUserStatut } = require("./userStatut");

function signAuthToken(user) {
  const payload = { id: user.id, role: user.role, nom: user.nom };
  if (userStatutApplies(user.role)) payload.statut = user.statut;
  return jwt.sign(payload, process.env.JWT_SECRET || "dev_secret", { expiresIn: "7d" });
}

function authUserPayload(user) {
  return attachPublicUserStatut({
    id: user.id,
    nom: user.nom,
    email: user.email,
    role: user.role,
    statut: user.statut,
  });
}

module.exports = { signAuthToken, authUserPayload };
