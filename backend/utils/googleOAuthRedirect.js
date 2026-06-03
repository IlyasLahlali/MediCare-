const crypto = require("crypto");
const {
  getGoogleClientId,
  verifyGoogleCredential,
  findOrCreateGoogleUser,
  googleAuthErrorMessage,
} = require("./googleAuth");
const { signAuthToken, authUserPayload } = require("./authToken");
const { googleHttpsPostForm } = require("./googleHttps");

const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function getGoogleClientSecret() {
  return String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
}

function isGoogleRedirectConfigured() {
  return !!(getGoogleClientId() && getGoogleClientSecret());
}

function getAppBaseUrl(req) {
  const fromEnv = String(process.env.PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  const host = req.get("x-forwarded-host") || req.get("host");
  return `${proto}://${host}`;
}

function getGoogleRedirectUri(req) {
  return `${getAppBaseUrl(req)}/api/auth/google/callback`;
}

function storeOAuthState(state, payload) {
  pendingStates.set(state, { ...payload, expires: Date.now() + STATE_TTL_MS });
}

function consumeOAuthState(state) {
  const entry = pendingStates.get(state);
  pendingStates.delete(state);
  if (!entry || Date.now() > entry.expires) return null;
  return entry;
}

function safeNextPath(next) {
  const raw = String(next || "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/Utilisateur/html/Dashboard.html";
  }
  return raw;
}

function loginUrlWithError(req, message) {
  const base = getAppBaseUrl(req);
  return `${base}/Utilisateur/html/login.html?google_error=${encodeURIComponent(message)}`;
}

async function exchangeCodeForIdToken(code, redirectUri) {
  let res;
  try {
    res = await googleHttpsPostForm("https://oauth2.googleapis.com/token", {
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
  } catch (netErr) {
    const err = new Error(
      netErr.message === "fetch failed" || netErr.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
        ? "Connexion SSL vers Google impossible (certificat). En local Windows, ajoutez GOOGLE_OAUTH_RELAX_TLS=1 dans backend/.env."
        : netErr.message
    );
    err.code = "GOOGLE_NETWORK_ERROR";
    throw err;
  }
  const data = res.data || {};
  if (!res.ok || !data.id_token) {
    const detail = data.error || data.error_description || "échange du code Google refusé";
    console.error("Google token exchange:", data);
    const err = new Error(detail);
    err.code = "GOOGLE_TOKEN_EXCHANGE_FAILED";
    throw err;
  }
  return data.id_token;
}

function startGoogleOAuth(req, res) {
  if (!isGoogleRedirectConfigured()) {
    return res.redirect(
      loginUrlWithError(
        req,
        "Ajoutez GOOGLE_CLIENT_SECRET dans backend/.env puis redémarrez le serveur."
      )
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const nextPath = safeNextPath(req.query.next);
  const redirectUri = getGoogleRedirectUri(req);
  storeOAuthState(state, { nextPath, redirectUri });
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

async function handleGoogleOAuthCallback(req, res) {
  const { code, state, error: oauthError } = req.query;
  const base = getAppBaseUrl(req);

  if (oauthError) {
    return res.redirect(
      loginUrlWithError(req, "Connexion Google annulée.")
    );
  }

  if (!code || !state) {
    return res.redirect(loginUrlWithError(req, "Réponse Google incomplète."));
  }

  const oauthState = consumeOAuthState(String(state));
  if (!oauthState) {
    return res.redirect(loginUrlWithError(req, "Session expirée. Réessayez."));
  }

  try {
    const redirectUri = oauthState.redirectUri || getGoogleRedirectUri(req);
    const idToken = await exchangeCodeForIdToken(String(code), redirectUri);
    const profile = await verifyGoogleCredential(idToken);
    const user = await findOrCreateGoogleUser(profile);

    if (user.statut === "REFUSE") {
      return res.redirect(loginUrlWithError(req, "Compte refusé par l'administrateur."));
    }
    if (user.statut === "EN_ATTENTE" && user.role !== "PHARMACIEN") {
      return res.redirect(loginUrlWithError(req, "Compte en attente de validation."));
    }

    const token = signAuthToken(user);
    const callbackUrl = new URL(`${base}/Utilisateur/html/google-auth-callback.html`);
    callbackUrl.searchParams.set("token", token);
    callbackUrl.searchParams.set("next", oauthState.nextPath);
    res.redirect(callbackUrl.toString());
  } catch (err) {
    console.error("Google OAuth callback:", err);
    const redirectUri = oauthState.redirectUri || getGoogleRedirectUri(req);
    let msg = err.message || googleAuthErrorMessage(err.code) || "Connexion Google impossible.";

    if (err.code === "GOOGLE_TOKEN_EXCHANGE_FAILED") {
      const hint =
        err.message === "invalid_client"
          ? "Secret client incorrect : copiez le code secret actuel depuis Google Cloud → Clients dans GOOGLE_CLIENT_SECRET (.env), puis redémarrez npm start."
          : err.message === "redirect_uri_mismatch"
            ? `Ajoutez cette URI de redirection exacte dans Google Cloud : ${redirectUri}`
            : `URI attendue : ${redirectUri}. Détail Google : ${err.message}`;
      msg = hint;
    } else if (err.code && googleAuthErrorMessage(err.code)) {
      msg = googleAuthErrorMessage(err.code);
    }

    res.redirect(loginUrlWithError(req, msg));
  }
}

module.exports = {
  isGoogleRedirectConfigured,
  getGoogleRedirectUri,
  startGoogleOAuth,
  handleGoogleOAuthCallback,
};
