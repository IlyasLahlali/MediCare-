const jwt = require("jsonwebtoken");

function signAuthToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, nom: user.nom, statut: user.statut },
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: "7d" }
  );
}

function authUserPayload(user) {
  return {
    id: user.id,
    nom: user.nom,
    email: user.email,
    role: user.role,
    statut: user.statut,
  };
}

module.exports = { signAuthToken, authUserPayload };
