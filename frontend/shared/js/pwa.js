/**
 * MediCare+ PWA — manifest, hors ligne, Service Worker.
 */
function medicareAppOrigin() {
  if (location.port === "5500" || location.port === "5501") {
    return "http://localhost:3000";
  }
  return location.origin;
}

function injectPwaHead() {
  if (document.querySelector('link[rel="manifest"]')) return;

  const origin = medicareAppOrigin();

  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = `${origin}/manifest.webmanifest`;
  document.head.appendChild(manifest);

  if (!document.querySelector('meta[name="theme-color"]')) {
    const theme = document.createElement("meta");
    theme.name = "theme-color";
    theme.content = "#0f766e";
    document.head.appendChild(theme);
  }

  if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
    const apple = document.createElement("meta");
    apple.name = "apple-mobile-web-app-capable";
    apple.content = "yes";
    document.head.appendChild(apple);
  }

  if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
    const title = document.createElement("meta");
    title.name = "apple-mobile-web-app-title";
    title.content = "MediCare+";
    document.head.appendChild(title);
  }

  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const touch = document.createElement("link");
    touch.rel = "apple-touch-icon";
    touch.href = `${origin}/shared/icons/apple-touch-icon.png`;
    document.head.appendChild(touch);
  }

  if (!document.querySelector('link[data-mc-pwa-css="1"]')) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${origin}/shared/css/pwa-offline.css`;
    css.dataset.mcPwaCss = "1";
    document.head.appendChild(css);
  }
}

function ensureOfflineBanner() {
  if (document.getElementById("mc-offline-banner")) return;
  const banner = document.createElement("div");
  banner.id = "mc-offline-banner";
  banner.className = "mc-offline-banner";
  banner.setAttribute("role", "status");
  banner.hidden = true;
  banner.textContent =
    "Mode hors ligne — pharmacies et fiches déjà consultées restent visibles. Carte et connexion nécessitent internet.";
  document.body.prepend(banner);
}

/** Évite le flash au refresh : CSS PWA chargé en async + navigator.onLine parfois faux une fraction de seconde. */
let offlineBannerTimer = null;
const OFFLINE_BANNER_DELAY_MS = 600;

function applyOnlineStatus(online) {
  document.body.classList.toggle("is-offline", !online);
  const banner = document.getElementById("mc-offline-banner");
  if (banner) banner.hidden = online;
  window.dispatchEvent(
    new CustomEvent("medicare-connection-change", { detail: { online } })
  );
}

function setOnlineStatus(online) {
  if (online) {
    if (offlineBannerTimer) {
      clearTimeout(offlineBannerTimer);
      offlineBannerTimer = null;
    }
    applyOnlineStatus(true);
    return;
  }
  if (offlineBannerTimer) clearTimeout(offlineBannerTimer);
  offlineBannerTimer = setTimeout(() => {
    offlineBannerTimer = null;
    if (!navigator.onLine) applyOnlineStatus(false);
  }, OFFLINE_BANNER_DELAY_MS);
}

function bindConnectionStatus() {
  ensureOfflineBanner();
  setOnlineStatus(navigator.onLine);

  window.addEventListener("online", () => setOnlineStatus(true));
  window.addEventListener("offline", () => setOnlineStatus(false));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const origin = medicareAppOrigin();
  navigator.serviceWorker
    .register(`${origin}/sw.js`, { scope: "/" })
    .then(() => navigator.serviceWorker.ready)
    .catch((err) => console.warn("PWA:", err.message));
}

function initPwa() {
  injectPwaHead();
  bindConnectionStatus();
  registerServiceWorker();
}

/** Bandeau HTML pour listes chargées depuis le cache SW. */
function medicareOfflineNoticeHtml() {
  return `<p class="mc-offline-notice" role="status">Données enregistrées lors de votre dernière visite (hors ligne).</p>`;
}

window.initPwa = initPwa;
window.medicareOfflineNoticeHtml = medicareOfflineNoticeHtml;
window.medicareIsOffline = () => !navigator.onLine;
