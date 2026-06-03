const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { authRequired } = require("../middleware/authMiddleware");
const { createNotification } = require("../utils/notificationHelper");
const { signAuthToken, authUserPayload } = require("../utils/authToken");
const {
  getGoogleClientId,
  verifyGoogleCredential,
  findOrCreateGoogleUser,
  googleAuthErrorMessage,
} = require("../utils/googleAuth");
const {
  isGoogleRedirectConfigured,
  startGoogleOAuth,
  handleGoogleOAuthCallback,
} = require("../utils/googleOAuthRedirect");

const router = express.Router();

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function ensureResetTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      utilisateur_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_token_hash (token_hash),
      INDEX idx_user_expires (utilisateur_id, expires_at),
      FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
    )
  `);
}

router.get("/google/client-id", (req, res) => {
  const clientId = getGoogleClientId();
  const { getGoogleRedirectUri } = require("../utils/googleOAuthRedirect");
  res.json({
    clientId: clientId || null,
    enabled: !!clientId,
    redirectEnabled: isGoogleRedirectConfigured(),
    redirectUri: clientId ? getGoogleRedirectUri(req) : null,
    pageOrigin: req.get("origin") || null,
  });
});

router.get("/google/start", (req, res) => startGoogleOAuth(req, res));

router.get("/google/callback", (req, res) => handleGoogleOAuthCallback(req, res));

router.post("/google", async (req, res) => {
  const credential = req.body?.credential || req.body?.idToken;
  if (!credential) {
    return res.status(400).json({ error: "credential requis (jeton Google)" });
  }

  try {
    const profile = await verifyGoogleCredential(credential);
    const user = await findOrCreateGoogleUser(profile);

    if (user.statut === "REFUSE") {
      return res.status(403).json({ error: "Compte refusé par l'administrateur" });
    }
    if (user.statut === "EN_ATTENTE" && user.role !== "PHARMACIEN") {
      return res.status(403).json({ error: "Compte en attente de validation" });
    }

    const token = signAuthToken(user);
    res.json({ token, user: authUserPayload(user) });
  } catch (err) {
    if (err.code) {
      const status =
        err.code === "PRO_ACCOUNT" || err.code === "REFUSED" ? 403 : 401;
      return res.status(status).json({ error: googleAuthErrorMessage(err.code) });
    }
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/me", authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nom, email, role, statut, date_creation FROM utilisateurs WHERE id = ?`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Utilisateur introuvable" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/register", async (req, res) => {
  const { nom, email, mot_de_passe, role } = req.body;
  if (!nom || !email || !mot_de_passe) {
    return res.status(400).json({ error: "nom, email et mot_de_passe requis" });
  }

  const allowedRoles = ["UTILISATEUR", "PHARMACIEN"];
  const userRole = allowedRoles.includes(role) ? role : "UTILISATEUR";
  const statut = userRole === "PHARMACIEN" ? "EN_ATTENTE" : "VALIDE";

  try {
    const hash = await bcrypt.hash(mot_de_passe, 10);
    const [result] = await pool.query(
      `INSERT INTO utilisateurs (nom, email, mot_de_passe, role, statut) VALUES (?, ?, ?, ?, ?)`,
      [nom, email, hash, userRole, statut]
    );

    if (userRole === "UTILISATEUR") {
      await createNotification({
        userId: result.insertId,
        type: "SYSTEM",
        titre: "Bienvenue sur MediCare+",
        message:
          "Votre compte est prêt. Explorez les pharmacies proches, enregistrez vos favoris et partagez vos avis.",
        lien: "/Utilisateur/html/Dashboard.html",
      });
    } else if (userRole === "PHARMACIEN") {
      await createNotification({
        userId: result.insertId,
        type: "SYSTEM",
        titre: "Bienvenue sur MediCare+ Pro",
        message:
          "Gérez vos pharmacies, activez le mode de garde et recevez des alertes (avis clients, rappels de garde).",
        lien: "/Pharmacien/html/Dashboard.html",
      });
    }

    res.status(201).json({
      id: result.insertId,
      message:
        userRole === "PHARMACIEN"
          ? "Compte créé. Connexion possible ; vos pharmacies seront visibles après validation admin."
          : "Compte créé avec succès",
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email déjà utilisé" });
    }
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

async function patchUserProfile(req, res, successMessage = "Profil mis à jour") {
  const { nom, email } = req.body;
  const nomTrim = nom != null ? String(nom).trim() : "";
  const emailProvided = email != null && String(email).trim() !== "";

  if (!nomTrim && !emailProvided) {
    return res.status(400).json({ error: "nom ou email requis" });
  }
  if (nomTrim && nomTrim.length < 2) {
    return res.status(400).json({ error: "Le nom doit contenir au moins 2 caractères" });
  }

  let emailNorm;
  if (emailProvided) {
    emailNorm = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json({ error: "Adresse email invalide" });
    }
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, nom, email, role, statut, date_creation FROM utilisateurs WHERE id = ?`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Utilisateur introuvable" });
    const user = rows[0];
    const nextNom = nomTrim || user.nom;
    const nextEmail = emailNorm || user.email;

    await pool.query(`UPDATE utilisateurs SET nom = ?, email = ? WHERE id = ?`, [
      nextNom,
      nextEmail,
      user.id,
    ]);

    res.json({
      message: successMessage,
      user: {
        id: user.id,
        nom: nextNom,
        email: nextEmail,
        role: user.role,
        statut: user.statut,
        date_creation: user.date_creation,
      },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Cette adresse email est déjà utilisée" });
    }
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

router.patch("/profile", authRequired, (req, res) => patchUserProfile(req, res));

router.patch("/email", authRequired, async (req, res) => {
  const { email, mot_de_passe } = req.body;
  if (!email) {
    return res.status(400).json({ error: "email requis" });
  }
  if (mot_de_passe) {
    try {
      const [rows] = await pool.query(`SELECT mot_de_passe FROM utilisateurs WHERE id = ?`, [
        req.user.id,
      ]);
      if (!rows.length) return res.status(404).json({ error: "Utilisateur introuvable" });
      if (!rows[0].mot_de_passe) {
        return res.status(400).json({
          error: "Compte Google : modifiez l'email sans mot de passe ou définissez un mot de passe d'abord.",
        });
      }
      const ok = await bcrypt.compare(mot_de_passe, rows[0].mot_de_passe);
      if (!ok) return res.status(401).json({ error: "Mot de passe actuel incorrect" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }
  req.body = { email };
  return patchUserProfile(req, res, "Adresse email mise à jour");
});

router.patch("/password", authRequired, async (req, res) => {
  const { mot_de_passe_actuel, mot_de_passe_nouveau } = req.body;
  if (!mot_de_passe_actuel || !mot_de_passe_nouveau) {
    return res.status(400).json({ error: "mot_de_passe_actuel et mot_de_passe_nouveau requis" });
  }
  if (String(mot_de_passe_nouveau).length < 6) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit faire au moins 6 caractères" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, mot_de_passe FROM utilisateurs WHERE id = ?`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Utilisateur introuvable" });
    if (!rows[0].mot_de_passe) {
      const hash = await bcrypt.hash(mot_de_passe_nouveau, 10);
      await pool.query(`UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?`, [hash, req.user.id]);
      return res.json({
        message: "Mot de passe créé. Vous pouvez aussi vous connecter avec Google.",
      });
    }
    const ok = await bcrypt.compare(mot_de_passe_actuel, rows[0].mot_de_passe);
    if (!ok) return res.status(401).json({ error: "Mot de passe actuel incorrect" });

    const hash = await bcrypt.hash(mot_de_passe_nouveau, 10);
    await pool.query(`UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?`, [hash, req.user.id]);
    res.json({ message: "Mot de passe mis à jour" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  if (!email) return res.status(400).json({ error: "email requis" });

  const genericMsg =
    "Si un compte existe avec cette adresse, des instructions de réinitialisation ont été préparées.";

  try {
    await ensureResetTable();
    const [rows] = await pool.query(`SELECT id FROM utilisateurs WHERE email = ?`, [email]);
    if (!rows.length) {
      return res.json({ message: genericMsg });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE utilisateur_id = ? AND used_at IS NULL`,
      [rows[0].id]
    );
    await pool.query(
      `INSERT INTO password_reset_tokens (utilisateur_id, token_hash, expires_at) VALUES (?, ?, ?)`,
      [rows[0].id, tokenHash, expiresAt]
    );

    const payload = { message: genericMsg };
    if (process.env.DEV_RESET_LINK === "1") {
      payload.resetLink = `/Utilisateur/html/reinitialiser-mot-de-passe.html?token=${encodeURIComponent(token)}`;
      payload.devNote =
        "Mode développement : le lien de réinitialisation est affiché ici (pas d'envoi d'email).";
    }
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, mot_de_passe_nouveau } = req.body;
  if (!token || !mot_de_passe_nouveau) {
    return res.status(400).json({ error: "token et mot_de_passe_nouveau requis" });
  }
  if (String(mot_de_passe_nouveau).length < 6) {
    return res.status(400).json({ error: "Le mot de passe doit faire au moins 6 caractères" });
  }

  try {
    await ensureResetTable();
    const tokenHash = hashResetToken(String(token).trim());
    const [rows] = await pool.query(
      `SELECT id, utilisateur_id FROM password_reset_tokens
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [tokenHash]
    );
    if (!rows.length) {
      return res.status(400).json({ error: "Lien invalide ou expiré. Demandez un nouveau lien." });
    }

    const hash = await bcrypt.hash(mot_de_passe_nouveau, 10);
    await pool.query(`UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?`, [
      hash,
      rows[0].utilisateur_id,
    ]);
    await pool.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?`, [
      rows[0].id,
    ]);

    res.json({ message: "Mot de passe réinitialisé. Vous pouvez vous connecter." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/login", async (req, res) => {
  const { email, mot_de_passe } = req.body;
  if (!email || !mot_de_passe) {
    return res.status(400).json({ error: "email et mot_de_passe requis" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, nom, email, mot_de_passe, role, statut FROM utilisateurs WHERE email = ?`,
      [email]
    );
    if (!rows.length) return res.status(401).json({ error: "Identifiants invalides" });

    const user = rows[0];
    if (!user.mot_de_passe) {
      return res.status(401).json({
        error: "Ce compte utilise la connexion Google. Cliquez sur « Continuer avec Google ».",
      });
    }
    const ok = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!ok) return res.status(401).json({ error: "Identifiants invalides" });

    if (user.statut === "REFUSE") {
      return res.status(403).json({ error: "Compte refusé par l'administrateur" });
    }
    if (user.statut === "EN_ATTENTE" && user.role !== "PHARMACIEN") {
      return res.status(403).json({ error: "Compte en attente de validation" });
    }

    const token = signAuthToken(user);
    res.json({ token, user: authUserPayload(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
