/**
 * Connexion Google — redirection OAuth (fiable en local, sans popup GIS).
 */
const GoogleAuth = (() => {
  function showBlock(el, visible) {
    if (!el) return;
    if (visible) {
      el.removeAttribute("hidden");
      el.setAttribute("aria-hidden", "false");
    } else {
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
    }
  }

  function readClientIdFromMeta() {
    const meta = document.querySelector('meta[name="medicare-google-client-id"]');
    return meta?.getAttribute("content")?.trim() || null;
  }

  async function isGoogleEnabled() {
    try {
      const cfg = await MediCareAPI.getGoogleClientId();
      return !!(cfg?.clientId && cfg?.redirectEnabled !== false);
    } catch {
      return !!readClientIdFromMeta();
    }
  }

  function showMountMessage(mount, message, isError = false) {
    const cls = isError ? "auth-google-hint auth-google-hint--error" : "auth-google-hint";
    mount.innerHTML = `<p class="${cls}">${message}</p>`;
    showBlock(mount, true);
  }

  function renderGoogleButton(mount, onClick) {
    mount.innerHTML = `
      <button type="button" class="auth-google-btn">
        <span class="auth-google-btn__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.183 36 24 36c-7.18 0-13-5.82-13-13s5.82-13 13-13c3.27 0 6.25 1.22 8.53 3.22l6.02-6.02C33.68 5.61 29.1 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.27 0 6.25 1.22 8.53 3.22l6.02-6.02C33.68 5.61 29.1 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
        </span>
        <span class="auth-google-btn__text">Continuer avec Google</span>
      </button>`;
    mount.querySelector(".auth-google-btn")?.addEventListener("click", onClick);
  }

  function startGoogleRedirect(nextPath) {
    const next = nextPath || "/Utilisateur/html/Dashboard.html";
    const url = `${location.origin}/api/auth/google/start?next=${encodeURIComponent(next)}`;
    window.location.href = url;
  }

  /**
   * @param {Object} options
   * @param {string} [options.mountId]
   * @param {string} [options.dividerId]
   * @param {string} [options.errorElId]
   * @param {string} [options.nextPath]
   */
  async function initButton(options = {}) {
    const mount = document.getElementById(options.mountId || "google-signin-mount");
    const divider = options.dividerId
      ? document.getElementById(options.dividerId)
      : document.getElementById("auth-google-divider");

    if (!mount) return false;

    const enabled = await isGoogleEnabled();
    if (!enabled) {
      showBlock(divider, true);
      showMountMessage(
        mount,
        "Connexion Google : ajoutez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans backend/.env, puis redémarrez le serveur.",
        true
      );
      return false;
    }

    showBlock(divider, true);
    showBlock(mount, true);
    renderGoogleButton(mount, () => startGoogleRedirect(options.nextPath));
    return true;
  }

  return { initButton, startGoogleRedirect };
})();

window.GoogleAuth = GoogleAuth;
