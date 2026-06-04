const crypto = require("crypto");
const pool = require("../config/db");
const { userStatutApplies } = require("./userStatut");
const { createNotification } = require("./notificationHelper");
const { googleHttpsGetJson } = require("./googleHttps");

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
let certsCache = null;
let certsCacheAt = 0;

function getGoogleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || "").trim();
}

async function getGoogleSigningKeys() {
  if (certsCache && Date.now() - certsCacheAt < 60 * 60 * 1000) {
    return certsCache;
  }
  const res = await googleHttpsGetJson(GOOGLE_CERTS_URL);
  if (!res.ok) throw new Error("GOOGLE_CERTS_UNAVAILABLE");
  const data = res.data || {};
  certsCache = data.keys || [];
  certsCacheAt = Date.now();
  return certsCache;
}

async function verifyGoogleCredential(credential) {
  const clientId = getGoogleClientId();
  if (!clientId) {
    const err = new Error("GOOGLE_NOT_CONFIGURED");
    err.code = "GOOGLE_NOT_CONFIGURED";
    throw err;
  }

  const token = String(credential || "").trim();
  const parts = token.split(".");
  if (parts.length !== 3) {
    const err = new Error("INVALID_GOOGLE_TOKEN");
    err.code = "INVALID_GOOGLE_TOKEN";
    throw err;
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    const err = new Error("INVALID_GOOGLE_TOKEN");
    err.code = "INVALID_GOOGLE_TOKEN";
    throw err;
  }

  if (header.alg !== "RS256") {
    const err = new Error("INVALID_GOOGLE_TOKEN");
    err.code = "INVALID_GOOGLE_TOKEN";
    throw err;
  }

  const keys = await getGoogleSigningKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    certsCache = null;
    const err = new Error("INVALID_GOOGLE_TOKEN");
    err.code = "INVALID_GOOGLE_TOKEN";
    throw err;
  }

  const keyObject = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const signed = Buffer.from(`${headerB64}.${payloadB64}`, "utf8");
  const signature = Buffer.from(signatureB64, "base64url");
  const valid = crypto.verify("RSA-SHA256", signed, keyObject, signature);
  if (!valid) {
    const err = new Error("INVALID_GOOGLE_TOKEN");
    err.code = "INVALID_GOOGLE_TOKEN";
    throw err;
  }

  if (!GOOGLE_ISSUERS.has(payload.iss)) {
    const err = new Error("INVALID_GOOGLE_TOKEN");
    err.code = "INVALID_GOOGLE_TOKEN";
    throw err;
  }

  const aud = payload.aud;
  if (aud !== clientId && !(Array.isArray(aud) && aud.includes(clientId))) {
    const err = new Error("INVALID_GOOGLE_TOKEN");
    err.code = "INVALID_GOOGLE_TOKEN";
    throw err;
  }

  if (!payload.sub || !payload.email) {
    const err = new Error("INVALID_GOOGLE_TOKEN");
    err.code = "INVALID_GOOGLE_TOKEN";
    throw err;
  }

  if (payload.email_verified === false) {
    const err = new Error("EMAIL_NOT_VERIFIED");
    err.code = "EMAIL_NOT_VERIFIED";
    throw err;
  }

  const expMs = Number(payload.exp) * 1000;
  if (!Number.isFinite(expMs) || expMs < Date.now()) {
    const err = new Error("INVALID_GOOGLE_TOKEN");
    err.code = "INVALID_GOOGLE_TOKEN";
    throw err;
  }

  return {
    googleId: payload.sub,
    email: String(payload.email).trim().toLowerCase(),
    nom: String(payload.name || payload.given_name || payload.email.split("@")[0]).trim(),
  };
}

async function findOrCreateGoogleUser({ googleId, email, nom }) {
  const [byGoogle] = await pool.query(
    `SELECT id, nom, email, role, statut, mot_de_passe FROM utilisateurs WHERE google_id = ?`,
    [googleId]
  );
  if (byGoogle.length) return byGoogle[0];

  const [byEmail] = await pool.query(
    `SELECT id, nom, email, role, statut, mot_de_passe, google_id FROM utilisateurs WHERE email = ?`,
    [email]
  );

  if (byEmail.length) {
    const user = byEmail[0];
    if (user.role !== "UTILISATEUR") {
      const err = new Error("PRO_ACCOUNT");
      err.code = "PRO_ACCOUNT";
      throw err;
    }
    if (userStatutApplies(user.role) && user.statut === "REFUSE") {
      const err = new Error("REFUSED");
      err.code = "REFUSED";
      throw err;
    }
    if (user.google_id && user.google_id !== googleId) {
      const err = new Error("EMAIL_LINKED_OTHER_GOOGLE");
      err.code = "EMAIL_LINKED_OTHER_GOOGLE";
      throw err;
    }
    if (!user.google_id) {
      await pool.query(`UPDATE utilisateurs SET google_id = ? WHERE id = ?`, [googleId, user.id]);
    }
    const [updated] = await pool.query(
      `SELECT id, nom, email, role, statut FROM utilisateurs WHERE id = ?`,
      [user.id]
    );
    return updated[0];
  }

  const [result] = await pool.query(
    `INSERT INTO utilisateurs (nom, email, google_id, mot_de_passe, role, statut)
     VALUES (?, ?, ?, NULL, 'UTILISATEUR', 'VALIDE')`,
    [nom.slice(0, 100), email, googleId]
  );

  await createNotification({
    userId: result.insertId,
    type: "SYSTEM",
    titre: "Bienvenue sur MediCare+",
    message:
      "Votre compte Google est connecté. Explorez les pharmacies proches, enregistrez vos favoris et partagez vos avis.",
    lien: "/Utilisateur/html/Dashboard.html",
  });

  const [created] = await pool.query(
    `SELECT id, nom, email, role, statut FROM utilisateurs WHERE id = ?`,
    [result.insertId]
  );
  return created[0];
}

function googleAuthErrorMessage(code) {
  const map = {
    GOOGLE_NOT_CONFIGURED: "Connexion Google non configurée sur le serveur.",
    INVALID_GOOGLE_TOKEN: "Session Google invalide. Réessayez.",
    EMAIL_NOT_VERIFIED: "Votre adresse Google n'est pas vérifiée.",
    PRO_ACCOUNT:
      "Cet email est lié à un compte pharmacien. Connectez-vous avec email et mot de passe.",
    REFUSED: "Compte refusé par l'administrateur.",
    EMAIL_LINKED_OTHER_GOOGLE:
      "Cet email est déjà lié à un autre compte Google.",
    GOOGLE_TOKEN_EXCHANGE_FAILED:
      "Échange Google refusé (secret client ou URI de redirection).",
  };
  return map[code] || "";
}

module.exports = {
  getGoogleClientId,
  verifyGoogleCredential,
  findOrCreateGoogleUser,
  googleAuthErrorMessage,
};
