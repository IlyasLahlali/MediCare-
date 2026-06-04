/** Live Server (5500) ne sert pas l’API — redirection vers Express. */
(function redirectFromLiveServer() {
  if (location.port !== "5500" && location.port !== "5501") return;
  const m = location.pathname.match(/(\/(?:Public|Utilisateur|Pharmacien|Admin)\/html\/[^/]+\.html)/i);
  if (!m) return;
  window.location.replace(`http://localhost:3000${m[1]}${location.search}${location.hash}`);
})();

function appOrigin() {
  if (location.port === "5500" || location.port === "5501") {
    return "http://localhost:3000";
  }
  return location.origin;
}

function pageUrl(relativeFromFrontendRoot) {
  return `${appOrigin()}/${relativeFromFrontendRoot.replace(/^\//, "")}`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (km == null || Number.isNaN(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function parsePharmacyDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw || /^\d{1,2}:\d{2}/.test(raw)) return null;
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatPharmacyTime(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const timeMatch = raw.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) return `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
  const d = parsePharmacyDate(value);
  if (!d) return null;
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatPharmacyHours(open, close) {
  if (open && typeof open === "object") {
    if (typeof WeeklyPharmacyHours !== "undefined") {
      return WeeklyPharmacyHours.compactDisplay(open) || "—";
    }
    return formatPharmacyHours(open.heure_ouverture, open.heure_fermeture);
  }
  const start = formatPharmacyTime(open);
  const end = formatPharmacyTime(close);
  if (start && end) return `${start} – ${end}`;
  if (start) return `Dès ${start}`;
  if (end) return `Jusqu'à ${end}`;
  return "—";
}

/** Horaires sur cartes (liste / dashboard) : jour courant, pas la semaine entière. */
function formatPharmacyCardHours(p) {
  if (p && typeof p === "object" && typeof WeeklyPharmacyHours !== "undefined") {
    return WeeklyPharmacyHours.cardDisplay(p) || "—";
  }
  if (p && typeof p === "object") {
    return formatPharmacyHours(p.heure_ouverture, p.heure_fermeture);
  }
  return formatPharmacyHours(p);
}

/** Bloc horaires intégré à la grille « faits » (fiche détail). options.highlightToday : surligner le jour courant (défaut true). */
function pharmacyDetailHoursFactsHtml(p, options = {}) {
  const highlightToday = options.highlightToday !== false;
  if (typeof WeeklyPharmacyHours !== "undefined") {
    const week = WeeklyPharmacyHours.weekFromPharmacy(p);
    if (!week) {
      const fallback = formatPharmacyHours(p?.heure_ouverture, p?.heure_fermeture);
      if (!fallback || fallback === "—") return "";
      return `
        <li class="pharmacy-detail-sheet__facts-item--wide pharmacy-detail-sheet__facts-item--hours">
          <span class="pharmacy-detail-sheet__fact-icon" aria-hidden="true">🕐</span>
          <div class="pharmacy-detail-sheet__hours-wrap">
            <span class="pharmacy-detail-sheet__fact-label">Horaires</span>
            <p class="pharmacy-detail-sheet__hours-today">${escapeHtml(fallback)}</p>
          </div>
        </li>`;
    }
    const weekList = WeeklyPharmacyHours.listDisplayHtml(p, { highlightToday });
    return `
      <li class="pharmacy-detail-sheet__facts-item--wide pharmacy-detail-sheet__facts-item--hours">
        <span class="pharmacy-detail-sheet__fact-icon" aria-hidden="true">🕐</span>
        <div class="pharmacy-detail-sheet__hours-wrap">
          <span class="pharmacy-detail-sheet__fact-label">Horaires</span>
          <ul class="pharmacy-detail-hours-week pd-info-hours-list" aria-label="Horaires par jour">${weekList}</ul>
        </div>
      </li>`;
  }
  const line = formatPharmacyHours(p?.heure_ouverture, p?.heure_fermeture);
  if (!line || line === "—") return "";
  return `
    <li class="pharmacy-detail-sheet__facts-item--wide pharmacy-detail-sheet__facts-item--hours">
      <span class="pharmacy-detail-sheet__fact-icon" aria-hidden="true">🕐</span>
      <div class="pharmacy-detail-sheet__hours-wrap">
        <span class="pharmacy-detail-sheet__fact-label">Horaires</span>
        <p class="pharmacy-detail-sheet__hours-today">${escapeHtml(line)}</p>
      </div>
    </li>`;
}

function formatPharmacyDateTimeLabel(value) {
  const d = parsePharmacyDate(value);
  if (!d) return formatPharmacyTime(value);
  const date = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

function formatGardePlanningRange(debut, fin) {
  const a = parsePharmacyDate(debut);
  const b = parsePharmacyDate(fin);
  if (!a && !b) return null;
  if (!a) return formatPharmacyDateTimeLabel(fin);
  if (!b) return formatPharmacyDateTimeLabel(debut);

  const t1 = a.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const t2 = b.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const day1 = a.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  if (a.toDateString() === b.toDateString()) {
    return `${day1}, ${t1} – ${t2}`;
  }
  const day2 = b.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${day1} ${t1} – ${day2} ${t2}`;
}

function pharmacyHoursMetaHtml(p) {
  const hours = formatPharmacyHours(p);
  const gardeRange = formatGardePlanningRange(p.garde_date_debut, p.garde_date_fin);
  const gardeLine =
    p.est_de_garde &&
    `<p class="muted pharmacy-card-meta pharmacy-garde-hours">Garde : ${escapeHtml(
      gardeRange || "en cours"
    )}</p>`;
  return `
    <p class="muted pharmacy-card-meta">Tél. ${escapeHtml(p.telephone || "—")}</p>
    <p class="muted pharmacy-card-meta"><span class="pharmacy-hours-label">Horaires</span> ${escapeHtml(hours)}</p>
    ${gardeLine || ""}`;
}

function pharmacyHoursDetailHtml(p) {
  const hours = formatPharmacyHours(p);
  const gardeRange = formatGardePlanningRange(p.garde_date_debut, p.garde_date_fin);
  let html = `<p><strong>Horaires :</strong> ${escapeHtml(hours)}</p>`;
  if (p.est_de_garde) {
    html += `<p class="pharmacy-garde-hours"><strong>Garde :</strong> ${escapeHtml(
      gardeRange || "en cours"
    )}</p>`;
  }
  return html;
}

function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text ?? "";
  return d.innerHTML;
}

function medicamentDisponibleBadgeHtml() {
  return '<span class="badge badge-disponible">Disponible</span>';
}

function formatMedicamentPrix(prix) {
  if (prix == null || prix === "") return "";
  const n = Number(prix);
  if (!Number.isFinite(n)) return `${escapeHtml(String(prix))} DH`;
  return `${n.toFixed(2)} DH`;
}

function formatShortAddress(adresse) {
  if (!adresse) return "";
  const parts = String(adresse)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 3) return parts.join(", ");
  return `${parts[0]}, ${parts[parts.length - 2] || parts[1]}`;
}

function medicamentPrixHtml(prix) {
  const label = formatMedicamentPrix(prix);
  if (!label) return "";
  return `<span class="muted med-price"> · ${label}</span>`;
}

function renderPublicMedicamentStockCard(s) {
  const desc = s.description
    ? `<p class="med-card__desc">${escapeHtml(s.description)}</p>`
    : "";
  const prix = formatMedicamentPrix(s.prix);
  return `<article class="med-card med-card--compact">
    <div class="med-card__head">
      <h4 class="med-card__title">${escapeHtml(s.nom)}</h4>
      ${medicamentDisponibleBadgeHtml()}
    </div>
    ${desc}
    ${prix ? `<p class="med-card__price-inline">${escapeHtml(prix)}</p>` : ""}
  </article>`;
}

function medicamentSearchResultsUrl(zone, q, pharmacyId) {
  const page =
    zone === "utilisateur"
      ? "Utilisateur/html/rechercheMedicament.html"
      : "Public/html/rechercheMedicament.html";
  const params = new URLSearchParams({ q });
  if (pharmacyId) params.set("pharmacyId", String(pharmacyId));
  return `${pageUrl(page)}?${params.toString()}`;
}

function renderMedicamentSearchResultCard(row, zone, geoQuery = "") {
  const detailPath =
    zone === "utilisateur"
      ? `Utilisateur/html/pharmacieDetail.html?id=${row.id_pharmacie}`
      : `Public/html/pharmacieDetail.html?id=${row.id_pharmacie}`;
  const detailUrl = pageUrl(detailPath) + (geoQuery || "");
  const desc = row.description
    ? `<p class="med-card__desc">${escapeHtml(row.description)}</p>`
    : "";
  const prix = formatMedicamentPrix(row.prix);
  const prixBlock = prix
    ? `<span class="med-card__price">${escapeHtml(prix)}</span>`
    : "";
  const addr = formatShortAddress(row.adresse);
  const addressBlock = addr
    ? `<p class="med-card__address"><span class="med-card__address-icon" aria-hidden="true">📍</span>${escapeHtml(addr)}</p>`
    : "";

  return `<article class="med-card">
    <div class="med-card__top">
      <div class="med-card__icon" aria-hidden="true">💊</div>
      <div class="med-card__intro">
        <div class="med-card__head">
          <h3 class="med-card__title">${escapeHtml(row.nom)}</h3>
          ${medicamentDisponibleBadgeHtml()}
        </div>
        ${desc}
      </div>
    </div>
    <div class="med-card__pharmacy">
      <div class="med-card__pharmacy-row">
        <div>
          <span class="med-card__pharmacy-label">Pharmacie</span>
          <strong class="med-card__pharmacy-name">${escapeHtml(row.nom_pharmacie)}</strong>
        </div>
        ${prixBlock}
      </div>
      ${addressBlock}
    </div>
    <footer class="med-card__footer">
      <a href="${detailUrl}" class="btn btn-teal btn-small med-card__cta">Voir la pharmacie</a>
    </footer>
  </article>`;
}

function dedupeMedicamentResultsByPharmacy(list) {
  const seen = new Map();
  for (const row of list) {
    if (!seen.has(row.id_pharmacie)) seen.set(row.id_pharmacie, row);
  }
  return [...seen.values()];
}

async function loadMedicamentSearchResults(options) {
  const {
    resultsEl,
    summaryEl,
    q,
    pharmacyId,
    zone,
    geoQuery = "",
  } = options;

  if (summaryEl) {
    summaryEl.textContent = pharmacyId
      ? `Résultats pour « ${q} » dans la pharmacie sélectionnée`
      : `Résultats pour « ${q} » dans toutes les pharmacies`;
  }

  if (q.length < 2) {
    resultsEl.innerHTML = '<p class="muted">Saisissez au moins 2 caractères.</p>';
    return;
  }

  try {
    const list = await MediCareAPI.searchMedicaments(q, pharmacyId || undefined);
    if (!list.length) {
      resultsEl.innerHTML =
        '<p class="muted">Aucune pharmacie trouvée avec ce médicament en stock.</p>';
      return;
    }
    const rows = pharmacyId ? list : dedupeMedicamentResultsByPharmacy(list);
    const notice =
      list._offlineCache && typeof medicareOfflineNoticeHtml === "function"
        ? medicareOfflineNoticeHtml()
        : "";
    const cards = rows
      .map((row) => renderMedicamentSearchResultCard(row, zone, geoQuery))
      .join("");
    resultsEl.innerHTML =
      notice + `<div class="med-results-grid" role="list">${cards}</div>`;
  } catch (err) {
    resultsEl.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

function bindMedicamentSearchForm(formId, zone) {
  const form = document.getElementById(formId);
  if (!form) return;
  const input = form.querySelector("[name='med-q'], #search-med-q");
  const hint = form.querySelector("[data-med-hint]");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = (input?.value || "").trim();
    if (q.length < 2) {
      if (hint) hint.textContent = "Saisissez au moins 2 caractères.";
      return;
    }
    if (hint) hint.textContent = "";
    window.location.href = medicamentSearchResultsUrl(zone, q);
  });
}

function getUserPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

/** Position GPS fraîche (pas de cache session) — rapide, puis précision si possible. */
function getFreshUserPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    let settled = false;
    let best = null;
    let watchId = null;

    const toGeo = (pos) => ({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    });

    const finish = (geo) => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(hardStop);
      resolve(geo || best);
    };

    const onFix = (pos) => {
      const geo = toGeo(pos);
      if (!best || geo.accuracy < best.accuracy) best = geo;
      if (geo.accuracy <= 35) finish(geo);
    };

    watchId = navigator.geolocation.watchPosition(onFix, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 7000,
    });

    navigator.geolocation.getCurrentPosition(onFix, () => {}, {
      enableHighAccuracy: false,
      maximumAge: 0,
      timeout: 4000,
    });

    const hardStop = setTimeout(() => finish(best), 8000);
  });
}

function readGeoFromSession() {
  try {
    const raw = sessionStorage.getItem("userGeo");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function ensureUserGeo() {
  let geo = readGeoFromSession();
  if (geo) return geo;
  geo = await getUserPosition();
  if (geo) sessionStorage.setItem("userGeo", JSON.stringify(geo));
  return geo;
}

const COUNTRY_NAMES =
  /^(maroc|morocco|moroc|france|espagne|spain|algérie|algeria|tunisie|tunisia|ma)$/i;

function cleanQuartierLabel(value) {
  return String(value || "")
    .replace(/^arrondissement\s+(de\s+)?/i, "")
    .trim();
}

function quartierFromAdresse(adresse, ville) {
  if (!adresse) return "";
  const arr = adresse.match(/arrondissement\s+de\s+([^,]+)/i);
  if (arr) return cleanQuartierLabel(arr[1]) || arr[1].trim();

  const villeLc = (ville || "").toLowerCase();
  const parts = adresse.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (COUNTRY_NAMES.test(part)) continue;
    if (/^\d{4,6}$/.test(part)) continue;
    if (/préfecture|prefecture|marrakech-safi|grand\s+casablanca/i.test(part)) continue;
    if (villeLc && part.toLowerCase() === villeLc) continue;
    const label = cleanQuartierLabel(part);
    if (label.length >= 2) return label;
  }
  return "";
}

function normalizeQuartierVille(pharmacy) {
  let quartier = cleanQuartierLabel(pharmacy?.quartier);
  let ville = String(pharmacy?.ville || "").trim();

  if (COUNTRY_NAMES.test(ville)) {
    if (quartier && !COUNTRY_NAMES.test(quartier)) {
      ville = quartier;
      quartier = "";
    } else {
      ville = "";
    }
  }

  if (quartier && ville && quartier.toLowerCase() === ville.toLowerCase()) {
    quartier = "";
  }

  if (!quartier && pharmacy?.adresse) {
    quartier = quartierFromAdresse(pharmacy.adresse, ville);
  }

  return { quartier, ville };
}

function formatQuartierVille(pharmacy) {
  const { quartier, ville } = normalizeQuartierVille(pharmacy);
  if (quartier && ville) return `${quartier}, ${ville}`;
  return quartier || ville || "—";
}

function parseScheduleMinutes(value) {
  if (value == null || value === "") return null;
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Ouverte selon horaires du jour ; sans horaires → fermé (est_ouverte API = calculé). */
function isPharmacyOpenBySchedule(p, date = new Date()) {
  if (typeof WeeklyPharmacyHours !== "undefined") {
    const byWeek = WeeklyPharmacyHours.isOpenBySchedule(p, date);
    if (byWeek !== null) return byWeek;
  }
  const openM = parseScheduleMinutes(p.heure_ouverture);
  const closeM = parseScheduleMinutes(p.heure_fermeture);
  if (openM == null || closeM == null) return null;
  const nowM = date.getHours() * 60 + date.getMinutes();
  if (openM < closeM) return nowM >= openM && nowM < closeM;
  return nowM >= openM || nowM < closeM;
}

function pharmacyIsEffectivelyOpen(p) {
  if (p.est_de_garde) return true;
  if (p.fermeture_manuelle) return false;
  const bySchedule = isPharmacyOpenBySchedule(p);
  if (bySchedule !== null) return bySchedule;
  return !!p.est_ouverte;
}

function pharmacyBadges(p) {
  let html = "";
  const garde = !!p.est_de_garde;
  const ouverte = !garde && pharmacyIsEffectivelyOpen(p);
  if (garde) html += '<span class="badge badge-garde">De garde</span>';
  if (ouverte) html += '<span class="badge badge-open">Ouverte</span>';
  if (!ouverte && !garde) html += '<span class="badge badge-closed">Fermée</span>';
  return html;
}

/** Pastilles statut (fiche détail + cartes public / utilisateur / pharmacien). */
function pharmacyChipBadges(p) {
  const garde = !!p.est_de_garde;
  const ouverte = !garde && pharmacyIsEffectivelyOpen(p);
  if (garde) {
    return '<span class="pharmacy-detail-sheet__chip pharmacy-detail-sheet__chip--garde">🌙 De garde</span>';
  }
  if (ouverte) {
    return '<span class="pharmacy-detail-sheet__chip pharmacy-detail-sheet__chip--open">Ouverte</span>';
  }
  return '<span class="pharmacy-detail-sheet__chip pharmacy-detail-sheet__chip--closed">Fermée</span>';
}

function pharmacyImageUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${appOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

function renderPharmacyThumb(imagePath, altName) {
  const imgUrl = pharmacyImageUrl(imagePath);
  const alt = escapeHtml(altName || "Pharmacie");
  if (imgUrl) {
    return `<img src="${escapeHtml(imgUrl)}" alt="${alt}" class="pharmacy-thumb" loading="lazy" />`;
  }
  return '<div class="pharmacy-thumb pharmacy-thumb-empty" aria-hidden="true">🏥</div>';
}

function normalizePharmacyCardOptions(options = {}) {
  const opts = { ...options };
  if (opts.relativeUrl) return opts;
  const zone = opts.zone;
  if (
    (zone === "public" || zone === "utilisateur") &&
    /\/(Public|Utilisateur)\/html\//i.test(location.pathname)
  ) {
    opts.relativeUrl = true;
  }
  return opts;
}

function pharmacyDetailUrl(p, options = {}) {
  const geo = options.geoQuery || "";
  if (options.relativeUrl) {
    return `pharmacieDetail.html?id=${p.id}${geo}`;
  }
  const detailPath =
    options.zone === "utilisateur"
      ? "Utilisateur/html/pharmacieDetail.html"
      : options.zone === "pharmacien"
        ? "Pharmacien/html/pharmacieDetail.html"
        : "Public/html/pharmacieDetail.html";
  return pageUrl(`${detailPath}?id=${p.id}${geo}`);
}

function parsePharmacyCoord(value) {
  if (value == null || value === "") return null;
  let raw = value;
  if (typeof raw === "object") {
    raw = raw.toString?.() ?? "";
  }
  const n = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function pharmacyHasCoordinates(p) {
  return parsePharmacyCoord(p?.latitude) != null && parsePharmacyCoord(p?.longitude) != null;
}

let _pharmacyLocationMiniMap = null;

/** Carte Leaflet en lecture seule (fiche détail, admin, etc.). */
function mountPharmacyLocationMap(hostEl, p, options = {}) {
  if (!hostEl) return;
  const lat = parsePharmacyCoord(p?.latitude);
  const lon = parsePharmacyCoord(p?.longitude);
  if (lat == null || lon == null) {
    hostEl.innerHTML =
      '<p class="muted admin-pharmacy-location__empty">Position non renseignée.</p>';
    return;
  }
  if (typeof L === "undefined") {
    hostEl.innerHTML = '<p class="muted">Carte indisponible.</p>';
    return;
  }
  const mapId = options.mapId || "pharmacy-location-map-inner";
  const mapClass = options.mapClass || "pharmacy-location-map";
  hostEl.innerHTML = `<div id="${mapId}" class="${mapClass}" role="img" aria-label="Carte de localisation"></div>`;
  if (_pharmacyLocationMiniMap) {
    _pharmacyLocationMiniMap.remove();
    _pharmacyLocationMiniMap = null;
  }
  const zoom = options.zoom ?? 16;
  _pharmacyLocationMiniMap = L.map(mapId, { scrollWheelZoom: false }).setView([lat, lon], zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(_pharmacyLocationMiniMap);
  L.marker([lat, lon])
    .addTo(_pharmacyLocationMiniMap)
    .bindPopup(escapeHtml(p.nom || "Pharmacie"));
  requestAnimationFrame(() => {
    requestAnimationFrame(() => _pharmacyLocationMiniMap?.invalidateSize());
  });
}

function pharmacyMapUrl(p, options = {}) {
  if (!p?.id) return null;
  const geo = options.geoQuery || "";
  if (options.relativeUrl) {
    return `carte.html?id=${p.id}${geo}`;
  }
  const mapPath =
    options.zone === "utilisateur"
      ? "Utilisateur/html/carte.html"
      : "Public/html/carte.html";
  return pageUrl(`${mapPath}?id=${p.id}${geo}`);
}

function resolveUserGeoForDirections(options = {}) {
  if (options.geo?.lat != null && options.geo?.lon != null) {
    return options.geo;
  }
  const q = options.geoQuery || "";
  const latM = q.match(/(?:^|[?&])lat=([^&]+)/);
  const lonM = q.match(/(?:^|[?&])lon=([^&]+)/);
  if (latM && lonM) {
    const lat = parseFloat(latM[1]);
    const lon = parseFloat(lonM[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  return readGeoFromSession();
}

/** Trajet GPS (Google Maps) : position utilisateur → pharmacie si connue. */
function pharmacyDirectionsUrl(p, options = {}) {
  const lat = parsePharmacyCoord(p?.latitude);
  const lon = parsePharmacyCoord(p?.longitude);
  if (lat == null || lon == null) return null;

  const params = new URLSearchParams({
    api: "1",
    destination: `${lat},${lon}`,
  });
  const userGeo = resolveUserGeoForDirections(options);
  if (userGeo?.lat != null && userGeo?.lon != null) {
    params.set("origin", `${userGeo.lat},${userGeo.lon}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

const PHARMACY_ACTION_ICON = {
  call:
    '<svg class="pharmacy-detail-action-btn__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  locate:
    '<svg class="pharmacy-detail-action-btn__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2"/></svg>',
  route:
    '<svg class="pharmacy-detail-action-btn__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<polygon points="3 11 22 2 13 21 11 13 3 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  details:
    '<svg class="pharmacy-detail-action-btn__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function pharmacyDetailActionLinkHtml({ href, variant, icon, label, title, ariaLabel, extraAttrs = "" }) {
  const a11y = ariaLabel || title;
  return (
    `<a href="${escapeHtml(href)}" class="pharmacy-detail-action-btn pharmacy-detail-action-btn--${variant}"` +
    ` title="${escapeHtml(title)}" aria-label="${escapeHtml(a11y)}"${extraAttrs}>` +
    `${icon}<span class="pharmacy-detail-action-btn__text">${escapeHtml(label)}</span></a>`
  );
}

function pharmacyLocateButtonHtml(p, options = {}) {
  const url = pharmacyMapUrl(p, options);
  if (!url) return "";
  if (options.detailSheet) {
    return pharmacyDetailActionLinkHtml({
      href: url,
      variant: "outline",
      icon: PHARMACY_ACTION_ICON.locate,
      label: "Localiser",
      title: "Voir sur la carte MediCare+",
    });
  }
  const btnClass = options.enhancedCard
    ? "btn btn-outline btn-small pharmacy-card-btn"
    : "btn btn-outline btn-small";
  return `<a href="${escapeHtml(url)}" class="${btnClass}" title="Voir sur la carte MediCare+">Localiser</a>`;
}

function pharmacyDirectionsButtonHtml(p, options = {}) {
  const url = pharmacyDirectionsUrl(p, options);
  if (!url) return "";
  if (options.detailSheet || options.mapPopup) {
    return pharmacyDetailActionLinkHtml({
      href: url,
      variant: "outline",
      icon: PHARMACY_ACTION_ICON.route,
      label: "Itinéraire",
      title: "Ouvrir le trajet dans Google Maps",
      extraAttrs: ' target="_blank" rel="noopener noreferrer"',
    });
  }
  const btnClass = options.enhancedCard
    ? "btn btn-outline btn-small pharmacy-card-btn"
    : "btn btn-outline btn-small";
  return `<a href="${escapeHtml(url)}" class="${btnClass}" target="_blank" rel="noopener noreferrer" title="Ouvrir le trajet dans Google Maps">Itinéraire</a>`;
}

function pharmacyLocateAndDirectionsHtml(p, options = {}) {
  const locate = pharmacyLocateButtonHtml(p, options);
  const directions = pharmacyDirectionsButtonHtml(p, options);
  if (!locate && !directions) return "";
  if (options.enhancedCard) {
    return `${locate}${directions}`;
  }
  return `${locate}${directions}`;
}

function pharmacyMapPopupActionsHtml(p, { detailUrl, geo }) {
  const detail = pharmacyDetailActionLinkHtml({
    href: detailUrl,
    variant: "primary",
    icon: PHARMACY_ACTION_ICON.details,
    label: "Détails",
    title: "Voir la fiche complète",
    ariaLabel: p?.nom ? `Détails — ${p.nom}` : "Voir la fiche pharmacie",
  });
  const directions = pharmacyDirectionsButtonHtml(p, { geo, mapPopup: true });
  return `<div class="popup-actions popup-actions--enhanced">${detail}${directions}</div>`;
}

function pharmacyCallButtonHtml(p, pharmacyId) {
  const raw = String(p?.telephone || "").trim();
  if (!raw) return "";
  const telHref = `tel:${raw.replace(/[\s().-]/g, "")}`;
  const label = p?.nom ? `Appeler ${p.nom}` : "Appeler la pharmacie";
  return pharmacyDetailActionLinkHtml({
    href: telHref,
    variant: "primary",
    icon: PHARMACY_ACTION_ICON.call,
    label: "Appeler",
    title: raw,
    ariaLabel: label,
    extraAttrs: ` data-track-call="${escapeHtml(String(pharmacyId || ""))}"`,
  });
}

function pharmacyDetailCtaRowHtml(p, options = {}) {
  const sheetOpts = { ...options, detailSheet: true };
  const parts = [
    pharmacyCallButtonHtml(p, options.id),
    pharmacyLocateButtonHtml(p, sheetOpts),
    pharmacyDirectionsButtonHtml(p, sheetOpts),
  ].filter(Boolean);
  if (!parts.length) return "";
  return `<div class="pharmacy-detail-sheet__cta-row">${parts.join("")}</div>`;
}

function pharmacyEnhancedActionsHtml(p, options, detailUrl) {
  const btnOpts = { ...options, enhancedCard: true };
  const locate = pharmacyLocateButtonHtml(p, btnOpts);
  const directions = pharmacyDirectionsButtonHtml(p, btnOpts);
  const btns = [locate, directions].filter(Boolean).join("");
  const link = `<a href="${detailUrl}" class="btn btn-teal btn-small pharmacy-card-detail-btn">Voir détails</a>`;
  if (!btns) return link;
  return `${link}<div class="pharmacy-card-actions__btns">${btns}</div>`;
}

function renderPharmacyDetailHero(p, options = {}) {
  const {
    geoQuery = "",
    id,
    backHref = "recherchePharmacie.html",
    backLabel = "Retour",
    showFavori = false,
  } = options;
  const imgUrl = pharmacyImageUrl(p.image);
  const distChip =
    p.distance_km != null
      ? `<span class="pharmacy-detail-sheet__chip pharmacy-detail-sheet__chip--dist">À ${formatDistance(Number(p.distance_km))}</span>`
      : "";
  const loc = formatQuartierVille(p);
  const hoursFactsHtml = pharmacyDetailHoursFactsHtml(p);
  const gardeRange = formatGardePlanningRange(p.garde_date_debut, p.garde_date_fin);

  const thumbLabel = `Agrandir la photo de ${p.nom || "la pharmacie"}`;
  const thumbHtml = imgUrl
    ? `<button
        type="button"
        class="pharmacy-detail-sheet__thumb pharmacy-detail-sheet__thumb--photo"
        data-pharmacy-photo="${escapeHtml(imgUrl)}"
        data-pharmacy-photo-title="${escapeHtml(p.nom || "Pharmacie")}"
        aria-label="${escapeHtml(thumbLabel)}"
      >
        <img src="${escapeHtml(imgUrl)}" alt="" class="pharmacy-detail-sheet__thumb-img" />
        <span class="pharmacy-detail-sheet__thumb-zoom" aria-hidden="true"></span>
      </button>`
    : `<div class="pharmacy-detail-sheet__thumb" aria-hidden="true">
        <span class="pharmacy-detail-sheet__thumb-fallback">🏥</span>
      </div>`;

  const favoriBtn = showFavori
    ? `<button
        type="button"
        id="btn-favori"
        class="btn-favori btn-favori--toggle"
        aria-pressed="false"
        aria-label="Ajouter aux favoris"
        title="Ajouter aux favoris"
      >
        <svg class="btn-favori__icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path
            class="btn-favori__outline"
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
          <path
            class="btn-favori__fill"
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      </button>`
    : "";

  return `
      <div class="pharmacy-detail-sheet__toolbar">
        <a href="${escapeHtml(backHref)}" class="pharmacy-detail-sheet__back" aria-label="${escapeHtml(backLabel)}">
          <svg class="pharmacy-detail-sheet__back-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          <span>${escapeHtml(backLabel)}</span>
        </a>
      </div>

      <div class="pharmacy-detail-sheet__identity">
        ${thumbHtml}
        <div class="pharmacy-detail-sheet__meta">
          <div class="pharmacy-detail-sheet__headline">
            <h1 class="pharmacy-detail-sheet__title">${escapeHtml(p.nom)}</h1>
            ${favoriBtn}
          </div>
          ${loc !== "—" ? `<p class="pharmacy-detail-sheet__loc">${escapeHtml(loc)}</p>` : ""}
          <div class="pharmacy-detail-sheet__chips">
            ${pharmacyChipBadges(p)}
            ${distChip}
          </div>
        </div>
      </div>

      <ul class="pharmacy-detail-sheet__facts">
        <li>
          <span class="pharmacy-detail-sheet__fact-icon" aria-hidden="true">📞</span>
          <span class="pharmacy-detail-sheet__fact-label">Téléphone</span>
          <strong>${escapeHtml(p.telephone || "—")}</strong>
        </li>
        <li class="pharmacy-detail-sheet__facts-item--wide">
          <span class="pharmacy-detail-sheet__fact-icon" aria-hidden="true">📍</span>
          <span class="pharmacy-detail-sheet__fact-label">Adresse</span>
          <strong>${escapeHtml(p.adresse || "—")}</strong>
        </li>
        ${hoursFactsHtml}
        ${
          p.est_de_garde
            ? `<li>
          <span class="pharmacy-detail-sheet__fact-icon" aria-hidden="true">🌙</span>
          <span class="pharmacy-detail-sheet__fact-label">Garde</span>
          <strong>${escapeHtml(gardeRange || "En cours")}</strong>
        </li>`
            : ""
        }
      </ul>

      <div class="pharmacy-detail-sheet__actions">
        ${pharmacyDetailCtaRowHtml(p, { id, relativeUrl: true, geoQuery })}
      </div>`;
}

function ensurePharmacyPhotoLightbox() {
  let lb = document.getElementById("pharmacy-photo-lightbox");
  if (lb) return lb;

  lb = document.createElement("div");
  lb.id = "pharmacy-photo-lightbox";
  lb.className = "pharmacy-photo-lightbox";
  lb.hidden = true;
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.innerHTML = `
    <button type="button" class="pharmacy-photo-lightbox__backdrop" aria-label="Fermer"></button>
    <figure class="pharmacy-photo-lightbox__figure">
      <button type="button" class="pharmacy-photo-lightbox__close" aria-label="Fermer">×</button>
      <img class="pharmacy-photo-lightbox__img" src="" alt="" />
      <figcaption class="pharmacy-photo-lightbox__caption"></figcaption>
    </figure>`;
  document.body.appendChild(lb);
  return lb;
}

function openPharmacyPhotoLightbox(src, title) {
  const lb = ensurePharmacyPhotoLightbox();
  const img = lb.querySelector(".pharmacy-photo-lightbox__img");
  const caption = lb.querySelector(".pharmacy-photo-lightbox__caption");
  if (!img) return;

  img.src = src;
  img.alt = title ? `Photo de ${title}` : "Photo de la pharmacie";
  if (caption) caption.textContent = title || "";

  lb.hidden = false;
  document.body.classList.add("pharmacy-photo-lightbox-open");
  lb.querySelector(".pharmacy-photo-lightbox__close")?.focus();
}

function closePharmacyPhotoLightbox() {
  const lb = document.getElementById("pharmacy-photo-lightbox");
  if (!lb || lb.hidden) return;

  lb.hidden = true;
  document.body.classList.remove("pharmacy-photo-lightbox-open");
  const img = lb.querySelector(".pharmacy-photo-lightbox__img");
  if (img) img.removeAttribute("src");
}

let pharmacyPhotoLightboxBound = false;

function pharmacyPhotoZoomTitle(el) {
  return (
    el?.getAttribute("data-pharmacy-photo-title") ||
    document.getElementById("nom")?.value?.trim() ||
    document.getElementById("edit-pharmacy-subtitle")?.textContent?.trim() ||
    "Pharmacie"
  );
}

function pharmacyPhotoZoomSrc(el) {
  if (!el) return "";
  const fromAttr = el.getAttribute("data-pharmacy-photo");
  if (fromAttr) return fromAttr;
  if (el.matches("img") && el.src && !el.classList.contains("hidden")) return el.src;
  const img = el.querySelector?.("img[src]");
  if (img?.src && !img.classList.contains("hidden")) return img.src;
  return "";
}

function markPharmacyPhotoZoomable(imgEl, title) {
  if (!imgEl) return;
  imgEl.classList.add("js-pharmacy-photo-preview");
  if (title) imgEl.setAttribute("data-pharmacy-photo-title", title);
  imgEl.setAttribute("role", "button");
  imgEl.setAttribute("tabindex", "0");
  imgEl.setAttribute(
    "aria-label",
    title ? `Voir la photo de ${title} en grand` : "Voir la photo en grand"
  );
}

function unmarkPharmacyPhotoZoomable(imgEl) {
  if (!imgEl) return;
  imgEl.classList.remove("js-pharmacy-photo-preview");
  imgEl.removeAttribute("data-pharmacy-photo-title");
  imgEl.removeAttribute("role");
  imgEl.removeAttribute("tabindex");
  imgEl.removeAttribute("aria-label");
}

function tryOpenPharmacyPhotoFromTarget(target) {
  const el = target.closest("[data-pharmacy-photo], .js-pharmacy-photo-preview");
  if (!el) return false;
  const src = pharmacyPhotoZoomSrc(el);
  if (!src) return false;
  openPharmacyPhotoLightbox(src, pharmacyPhotoZoomTitle(el));
  return true;
}

function initPharmacyDetailHoursToggle() {
  if (window._pharmacyHoursToggleBound) return;
  window._pharmacyHoursToggleBound = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pharmacy-hours-toggle]");
    if (!btn) return;
    const panel = btn.closest(".pharmacy-detail-sheet__hours-wrap")?.querySelector(
      "[data-pharmacy-hours-week]"
    );
    if (!panel) return;
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.textContent = open ? "Réduire" : "Voir tous";
  });
}

function initPharmacyDetailPhotoZoom() {
  initPharmacyDetailHoursToggle();
  ensurePharmacyPhotoLightbox();

  if (!pharmacyPhotoLightboxBound) {
    pharmacyPhotoLightboxBound = true;

    document.addEventListener("click", (e) => {
      if (tryOpenPharmacyPhotoFromTarget(e.target)) {
        e.preventDefault();
        return;
      }

      if (
        e.target.closest(".pharmacy-photo-lightbox__close") ||
        e.target.closest(".pharmacy-photo-lightbox__backdrop")
      ) {
        e.preventDefault();
        closePharmacyPhotoLightbox();
      }
    });

    document.addEventListener("keydown", (e) => {
      const lb = document.getElementById("pharmacy-photo-lightbox");
      if (!lb || lb.hidden) {
        if (
          (e.key === "Enter" || e.key === " ") &&
          e.target.classList?.contains("js-pharmacy-photo-preview") &&
          !e.target.classList.contains("hidden")
        ) {
          e.preventDefault();
          tryOpenPharmacyPhotoFromTarget(e.target);
        }
        return;
      }
      if (e.key === "Escape") closePharmacyPhotoLightbox();
    });
  }
}

/** Retour : page précédente si même site, sinon lien de secours (fallbackHref). */
function initPharmacyDetailBackLink(fallbackHref) {
  const back = document.querySelector(".pharmacy-detail-sheet__back");
  if (!back || back.dataset.backBound === "1") return;
  back.dataset.backBound = "1";

  const fallback = fallbackHref || back.getAttribute("href") || "recherchePharmacie.html";
  if (fallbackHref) back.setAttribute("href", fallback);

  back.addEventListener("click", (e) => {
    const ref = document.referrer;
    let sameOrigin = false;
    if (ref) {
      try {
        sameOrigin = new URL(ref).origin === location.origin;
      } catch {
        sameOrigin = false;
      }
    }
    if (sameOrigin && window.history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
}

function renderPharmacyStockGrid(stock) {
  if (!stock.length) {
    return '<p class="muted pharmacy-detail-stock-empty">Aucun médicament en stock publié pour le moment.</p>';
  }
  return `<div class="med-results-grid">${stock.map((s) => renderPublicMedicamentStockCard(s)).join("")}</div>`;
}

function filterPharmacyStockByQuery(stock, query) {
  if (!Array.isArray(stock)) return [];
  const q = String(query || "").trim();
  if (q.length < 2) return [];

  if (typeof rankMedicamentRows === "function") {
    const fuzzyHits = rankMedicamentRows(stock, q);
    if (fuzzyHits.length) return fuzzyHits;
  }

  const qLower = q.toLowerCase();
  return stock.filter((item) => {
    const nom = String(item.nom || "").toLowerCase();
    const desc = String(item.description || "").toLowerCase();
    return nom.includes(qLower) || desc.includes(qLower);
  });
}

function pharmacyDetailStockPromptHtml(count) {
  const n = Number(count) || 0;
  const label = n === 1 ? "1 médicament référencé" : `${n} médicaments référencés`;
  return `<div class="pharmacy-detail-stock-prompt">
    <span class="pharmacy-detail-stock-prompt__icon" aria-hidden="true">🔍</span>
    <p class="pharmacy-detail-stock-prompt__title">Vérifiez la disponibilité ici</p>
    <p class="muted">Tapez le nom du médicament ci-dessus.${n ? ` <strong>${label}</strong> dans cette officine.` : ""}</p>
  </div>`;
}

function pharmacyDetailStockNoMatchHtml(query) {
  return `<div class="pharmacy-detail-stock-empty pharmacy-detail-stock-empty--nomatch">
    <p>Aucun résultat pour « <strong>${escapeHtml(query)}</strong> » dans cette pharmacie.</p>
    <p class="muted">Vérifiez l'orthographe ou cherchez sur toutes les pharmacies.</p>
  </div>`;
}

/**
 * Stock pharmacie : recherche inline, pas de liste complète au chargement.
 */
function initPharmacyDetailStock({ zone, pharmacyId }) {
  const stockEl = document.getElementById("stock-list");
  const summaryEl = document.getElementById("stock-summary");
  const countEl = document.getElementById("stock-count");
  const form = document.getElementById("pharmacy-stock-search-form");
  const input = document.getElementById("pharmacy-med-q");
  const inputWrap = input?.closest(".pharmacy-detail-search-input-wrap");
  const clearBtn = document.getElementById("btn-pharmacy-med-clear");
  const showAllBtn = document.getElementById("btn-stock-show-all");
  const toolbarEl = document.getElementById("stock-toolbar");
  const globalLink = document.getElementById("link-med-global-search");
  const hintEl = document.getElementById("stock-search-hint");
  const datalistEl = document.getElementById("pharmacy-med-suggestions");
  const resultsSection = document.getElementById("pharmacy-stock-results");

  if (!stockEl || !pharmacyId) return { load: async () => {} };

  function scrollToStockResults() {
    if (!resultsSection || currentQuery.length < 2) return;
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  let stockCache = [];
  let offlineNotice = "";
  let showAll = false;
  let currentQuery = "";

  function syncSearchInputUi() {
    const len = (input?.value || "").trim().length;

    if (clearBtn) clearBtn.hidden = len === 0;
    if (inputWrap) {
      inputWrap.classList.toggle("has-value", len > 0);
      inputWrap.classList.toggle("is-ready", len >= 2);
    }
  }

  function applySearchQuery(q, { focusInput = false } = {}) {
    currentQuery = String(q || "").trim();
    if (input) input.value = currentQuery;
    if (currentQuery.length >= 2) showAll = false;
    syncSearchInputUi();
    updateChrome();
    refreshView();
    if (focusInput) input?.focus();
  }

  function populateSearchSuggestions() {
    const names = [
      ...new Set(stockCache.map((item) => item.nom).filter(Boolean)),
    ].slice(0, 14);

    if (datalistEl) {
      datalistEl.innerHTML = names
        .map((nom) => `<option value="${escapeHtml(nom)}"></option>`)
        .join("");
    }
  }

  function setHintMessage(text, tone = "") {
    if (!hintEl) return;
    hintEl.textContent = text;
    hintEl.classList.remove("is-warn", "is-ok", "is-empty");
    if (tone) hintEl.classList.add(tone);
  }

  function medicamentSearchPageUrl() {
    const page =
      zone === "utilisateur"
        ? "Utilisateur/html/rechercheMedicament.html"
        : "Public/html/rechercheMedicament.html";
    return pageUrl(page);
  }

  function updateGlobalLink() {
    if (!globalLink) return;
    const q = currentQuery.trim();
    globalLink.textContent =
      q.length >= 2
        ? `Chercher « ${q} » sur tout MediCare+`
        : "Chercher un médicament sur tout MediCare+";
    globalLink.href = q.length >= 2 ? medicamentSearchResultsUrl(zone, q) : medicamentSearchPageUrl();
  }

  function updateChrome() {
    const n = stockCache.length;
    if (n > 0) {
      countEl.hidden = false;
      countEl.textContent = `${n} réf.`;
      summaryEl.textContent = `${n} médicament${n > 1 ? "s" : ""} référencé${n > 1 ? "s" : ""} dans cette officine.`;
      if (toolbarEl) toolbarEl.hidden = false;
      if (showAllBtn) {
        showAllBtn.hidden = false;
        showAllBtn.textContent = showAll
          ? "Masquer le catalogue"
          : `Afficher tout le stock (${n})`;
        showAllBtn.setAttribute("aria-pressed", showAll ? "true" : "false");
      }
    } else {
      countEl.hidden = true;
      summaryEl.textContent = "Aucune disponibilité publiée pour le moment.";
      if (toolbarEl) toolbarEl.hidden = true;
      if (showAllBtn) showAllBtn.hidden = true;
    }
    updateGlobalLink();
  }

  function refreshView() {
    if (!stockCache.length) {
      stockEl.innerHTML = offlineNotice + renderPharmacyStockGrid([]);
      setHintMessage("", "");
      syncSearchInputUi();
      return;
    }

    if (showAll) {
      stockEl.innerHTML = offlineNotice + renderPharmacyStockGrid(stockCache);
      setHintMessage("Catalogue complet de cette officine.", "is-ok");
      syncSearchInputUi();
      scrollToStockResults();
      return;
    }

    if (currentQuery.length < 2) {
      stockEl.innerHTML = offlineNotice + pharmacyDetailStockPromptHtml(stockCache.length);
      const len = (input?.value || "").trim().length;
      if (len === 0) {
        setHintMessage(
          "Saisissez au moins 2 lettres.",
          "is-empty"
        );
      } else {
        setHintMessage("Encore 1 lettre minimum pour lancer la recherche.", "is-warn");
      }
      syncSearchInputUi();
      return;
    }

    const filtered = filterPharmacyStockByQuery(stockCache, currentQuery);
    if (!filtered.length) {
      stockEl.innerHTML = offlineNotice + pharmacyDetailStockNoMatchHtml(currentQuery);
      setHintMessage(
        `Aucun résultat pour « ${currentQuery} » dans cette pharmacie.`,
        "is-warn"
      );
      scrollToStockResults();
    } else {
      stockEl.innerHTML = offlineNotice + renderPharmacyStockGrid(filtered);
      const nb = filtered.length;
      setHintMessage(
        `${nb} résultat${nb > 1 ? "s" : ""} pour « ${currentQuery} ».`,
        "is-ok"
      );
      scrollToStockResults();
    }
    syncSearchInputUi();
  }

  showAllBtn?.addEventListener("click", () => {
    showAll = !showAll;
    updateChrome();
    refreshView();
  });

  clearBtn?.addEventListener("click", () => {
    applySearchQuery("", { focusInput: true });
  });

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      applySearchQuery("", { focusInput: true });
    }
  });

  let debounceTimer;
  input?.addEventListener("input", () => {
    syncSearchInputUi();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentQuery = (input?.value || "").trim();
      if (currentQuery.length >= 2) showAll = false;
      updateChrome();
      refreshView();
    }, 220);
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = (input?.value || "").trim();
    if (q.length < 2) {
      setHintMessage("Encore 1 lettre minimum pour lancer la recherche.", "is-warn");
      syncSearchInputUi();
      input?.focus();
      return;
    }
    applySearchQuery(q, { focusInput: false });
  });

  return {
    async load() {
      stockEl.innerHTML = '<p class="muted pharmacy-detail-stock-loading">Chargement du stock…</p>';
      try {
        const stock = await MediCareAPI.getStock(pharmacyId);
        offlineNotice =
          stock._offlineCache && typeof medicareOfflineNoticeHtml === "function"
            ? medicareOfflineNoticeHtml()
            : "";
        stockCache = Array.isArray(stock) ? stock : [];
      } catch {
        stockCache = [];
        stockEl.innerHTML =
          '<p class="error pharmacy-detail-stock-empty">Impossible de charger le stock pour le moment.</p>';
        return;
      }
      populateSearchSuggestions();

      const urlQ = new URLSearchParams(location.search).get("q");
      if (urlQ) {
        currentQuery = urlQ.trim();
        if (input) input.value = currentQuery;
      }
      updateChrome();
      refreshView();
      syncSearchInputUi();
    },
  };
}

function renderPharmacyCard(p, options = {}) {
  options = normalizePharmacyCardOptions(options);
  const isEnhanced =
    options.zone === "public" || options.zone === "utilisateur" || options.zone === "pharmacien";
  const clickable = options.actionsHtml
    ? options.cardClickable === true
    : options.clickable !== false;
  const distKm =
    p.distance_km != null
      ? Number(p.distance_km)
      : options.distanceKm != null
        ? Number(options.distanceKm)
        : null;
  const distLabel = distKm != null && !Number.isNaN(distKm) ? formatDistance(distKm) : "";
  const dist = distLabel
    ? `<span class="distance" title="Distance à vol d'oiseau">À ${escapeHtml(distLabel)}</span>`
    : "";
  const detailUrl = pharmacyDetailUrl(p, options);
  const loc =
    formatQuartierVille(p) !== "—" ? formatQuartierVille(p) : p.adresse || "—";
  const titleExtra = options.titleExtra || "";
  const badgesExtra = options.badgesExtra || "";
  const metaExtra = options.metaExtra || "";
  const actionsHtml =
    options.actionsHtml ||
    (isEnhanced
      ? pharmacyEnhancedActionsHtml(p, options, detailUrl)
      : `<a href="${detailUrl}" class="btn btn-teal btn-small">Voir détails</a>${pharmacyLocateAndDirectionsHtml(p, options)}`);
  const cardClasses = [
    "card",
    "pharmacy-card",
    "pharmacy-card-with-img",
    clickable ? "pharmacy-card-clickable" : "",
    isEnhanced ? "pharmacy-card--enhanced" : "",
    options.zone === "pharmacien" ? "pharmacy-card--pharmacien" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const clickAttrs = clickable
    ? ` class="${cardClasses}" data-href="${escapeHtml(detailUrl)}" tabindex="0" role="link" aria-label="Ouvrir la fiche de ${escapeHtml(p.nom)}"`
    : ` class="${cardClasses}"`;

  const hours = isEnhanced ? formatPharmacyCardHours(p) : formatPharmacyHours(p);
  const gardeRange = formatGardePlanningRange(p.garde_date_debut, p.garde_date_fin);
  const gardeLine =
    p.est_de_garde &&
    `<p class="pharmacy-card-meta pharmacy-card-meta--garde">Garde : ${escapeHtml(
      gardeRange || "en cours"
    )}</p>`;

  const thumbBlock = isEnhanced
    ? `<div class="pharmacy-card-media">
        ${renderPharmacyThumb(p.image, p.nom)}
        <div class="pharmacy-card-media-overlay">
          <div class="pharmacy-card-status">${badgesExtra}${pharmacyChipBadges(p)}</div>
          ${dist ? `<div class="pharmacy-card-distance">${dist}</div>` : ""}
        </div>
      </div>`
    : renderPharmacyThumb(p.image, p.nom);

  const metaBlock = isEnhanced
    ? `<p class="pharmacy-card-meta pharmacy-card-meta--loc">
        <span class="pharmacy-card-meta-icon" aria-hidden="true">📍</span>${escapeHtml(loc)}
      </p>
      <p class="pharmacy-card-meta pharmacy-card-meta--hours">
        <span class="pharmacy-card-meta-icon" aria-hidden="true">🕐</span>${escapeHtml(hours)}
      </p>
      ${
        p.telephone
          ? `<p class="pharmacy-card-meta pharmacy-card-meta--tel">
              <span class="pharmacy-card-meta-icon" aria-hidden="true">📞</span>
              <a href="tel:${escapeHtml(String(p.telephone).replace(/\s/g, ""))}" class="pharmacy-card-tel">${escapeHtml(p.telephone)}</a>
            </p>`
          : ""
      }
      ${gardeLine || ""}`
    : `<p class="muted pharmacy-card-meta">${escapeHtml(loc)}</p>
        ${pharmacyHoursMetaHtml(p)}`;

  const headBadges = isEnhanced
    ? ""
    : `<div class="pharmacy-card-badges">${badgesExtra}${pharmacyBadges(p)} ${dist}</div>`;

  return `
    <article${clickAttrs}>
      ${thumbBlock}
      <div class="pharmacy-card-body">
        <div class="pharmacy-card-head">
          <h3>${escapeHtml(p.nom)}${titleExtra}</h3>
          ${headBadges}
        </div>
        ${metaBlock}
        ${metaExtra}
        <div class="pharmacy-card-actions">${actionsHtml}</div>
      </div>
    </article>`;
}

/**
 * Bouton « Descendez » : hero plein écran, contenu masqué jusqu’à interaction.
 * Réaffiché à chaque chargement de page (pas de mémorisation).
 * ?scrollhint=1 pour forcer l’affichage.
 */
function ensureScrollHintCss() {
  if (document.querySelector('link[data-mc-scroll-hint="1"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/shared/css/scrollHint.css?v=5";
  link.dataset.mcScrollHint = "1";
  document.head.appendChild(link);
}

function isPublicHomePage() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  return (
    path === "/" ||
    path === "/index.html" ||
    /\/Public\/html\/index\.html$/i.test(location.pathname)
  );
}

function initScrollDownHint(options = {}) {
  ensureScrollHintCss();
  const targetId = options.targetId || "pharmacies-proches";
  const legacyKeys = [
    options.storageKey,
    "medicare_scroll_hint",
    "medicare_scroll_hint_public_home",
    "medicare_scroll_hint_user_home",
    "medicare_scroll_hint_public_session",
    "medicare_scroll_hint_user_session",
  ].filter(Boolean);
  try {
    legacyKeys.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  } catch {
    /* ignore */
  }

  function mountHint() {
    const target = document.getElementById(targetId);
    const hero = document.querySelector(".public-hero");
    if (!target || !hero) return false;

    const existing = document.getElementById("scroll-down-hint");
    if (existing && !new URLSearchParams(location.search).has("scrollhint")) return true;
    document.getElementById("scroll-hint-stage")?.remove();
    if (existing) existing.remove();

    let dismissed = false;
    let guardsReady = false;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "scroll-down-hint";
    btn.className = "scroll-down-hint scroll-down-hint--visible";
    btn.setAttribute("aria-label", "Descendre vers les pharmacies à proximité");
    btn.innerHTML =
      '<span class="scroll-down-hint__ring" aria-hidden="true"></span>' +
      '<span class="scroll-down-hint__icon" aria-hidden="true">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg></span>" +
      '<span class="scroll-down-hint__label">Descendez</span>';

    const stage = document.createElement("div");
    stage.id = "scroll-hint-stage";
    stage.className = "scroll-hint-stage";
    stage.setAttribute("aria-hidden", "true");
    stage.innerHTML = '<div class="scroll-hint-stage__veil"></div>';

    document.body.appendChild(stage);
    document.body.appendChild(btn);

    const root = document.documentElement;
    root.classList.add("mc-scroll-hint-active");
    document.body.classList.add("mc-scroll-hint-active");
    window.scrollTo(0, 0);

    const cleanups = [];
    let touchStartY = null;

    function scrollToTarget() {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function dismiss(scrollAfter = false) {
      if (dismissed) return;
      dismissed = true;
      root.classList.add("mc-scroll-hint-leaving");
      document.body.classList.add("mc-scroll-hint-leaving");
      root.classList.remove("mc-scroll-hint-active");
      document.body.classList.remove("mc-scroll-hint-active");
      btn.classList.remove("scroll-down-hint--visible");
      btn.classList.add("scroll-down-hint--hide");
      stage.classList.add("scroll-hint-stage--hide");
      cleanups.forEach((fn) => fn());
      setTimeout(() => {
        stage.remove();
        btn.remove();
        root.classList.remove("mc-scroll-hint-leaving");
        document.body.classList.remove("mc-scroll-hint-leaving");
        if (scrollAfter) scrollToTarget();
      }, 420);
    }

    function onScroll() {
      if (!guardsReady || dismissed) return;
      if (window.scrollY > 32) dismiss(true);
    }

    function onWheel(e) {
      if (dismissed) return;
      if (Math.abs(e.deltaY) < 2) return;
      if (e.deltaY > 0) dismiss(true);
      else dismiss(false);
    }

    function onTouchStart(e) {
      if (e.touches.length) touchStartY = e.touches[0].clientY;
    }

    function onTouchMove(e) {
      if (dismissed || touchStartY == null || !e.touches.length) return;
      const delta = touchStartY - e.touches[0].clientY;
      if (Math.abs(delta) < 14) return;
      if (delta > 0) dismiss(true);
      else dismiss(false);
    }

    function onInteract(e) {
      if (!guardsReady || dismissed) return;
      if (e.target.closest(".scroll-down-hint")) return;
      dismiss(false);
    }

    function onKeydown(e) {
      if (dismissed) return;
      if (e.key === "Escape") dismiss(false);
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        dismiss(true);
      }
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      dismiss(true);
    });

    document.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => document.removeEventListener("scroll", onScroll));

    document.addEventListener("wheel", onWheel, { passive: true });
    cleanups.push(() => document.removeEventListener("wheel", onWheel));

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    cleanups.push(() => document.removeEventListener("touchstart", onTouchStart));

    document.addEventListener("touchmove", onTouchMove, { passive: true });
    cleanups.push(() => document.removeEventListener("touchmove", onTouchMove));

    document.addEventListener("click", onInteract, true);
    cleanups.push(() => document.removeEventListener("click", onInteract, true));

    document.addEventListener("keydown", onKeydown);
    cleanups.push(() => document.removeEventListener("keydown", onKeydown));

    setTimeout(() => {
      guardsReady = true;
    }, 500);

    return true;
  }

  if (mountHint()) return;
  document.addEventListener("DOMContentLoaded", () => mountHint(), { once: true });
}

function bindPharmacyCardClicks(root = document) {
  root.querySelectorAll(".pharmacy-card-clickable[data-href]").forEach((card) => {
    const go = () => {
      window.location.href = card.dataset.href;
    };
    card.addEventListener("click", (e) => {
      if (e.target.closest("a, button")) return;
      go();
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go();
      }
    });
  });
}

/** Affiche une liste de cartes ; previewLimit = 6 pour « Voir plus » sur les dashboards. */
function mountPharmacyList(container, list, options = {}) {
  if (!container) return;
  const limit = options.previewLimit > 0 ? options.previewLimit : 0;
  const opts = normalizePharmacyCardOptions(options);
  const offlineNotice = opts.offlineNotice;
  const introHtml = opts.introHtml || "";
  delete opts.previewLimit;
  delete opts.offlineNotice;
  delete opts.introHtml;

  if (!list.length) {
    container.innerHTML =
      (introHtml || "") +
      (options.emptyHtml || '<p class="muted">Aucune pharmacie trouvée.</p>');
    return;
  }

  const noticeHtml =
    introHtml +
    (offlineNotice && typeof medicareOfflineNoticeHtml === "function"
      ? medicareOfflineNoticeHtml()
      : "");

  if (limit > 0 && list.length > limit) {
    container.innerHTML =
      noticeHtml +
      list
        .slice(0, limit)
        .map((p) => renderPharmacyCard(p, opts))
        .join("") +
      `<div class="pharmacy-list-more">
        <button type="button" class="btn btn-teal btn-small" data-pharmacy-show-all>
          Voir les ${list.length} pharmacies
        </button>
      </div>`;
    bindPharmacyCardClicks(container);
    container.querySelector("[data-pharmacy-show-all]")?.addEventListener("click", () => {
      mountPharmacyList(container, list, opts);
    });
    return;
  }

  container.innerHTML = noticeHtml + list.map((p) => renderPharmacyCard(p, opts)).join("");
  bindPharmacyCardClicks(container);
}

/**
 * Header / footer communs (fichiers html/header.html et html/footer.html par zone).
 * Aucune modification des fichiers .html des pages : injection au chargement via common.js.
 */
(function mediCareZoneLayout() {
  const zoneMatch = location.pathname.match(/\/(Public|Utilisateur|Pharmacien|Admin)\/html\//i);
  if (!zoneMatch) return;
  if (
    document.body.classList.contains("admin-auth-page") ||
    document.body.classList.contains("admin-login-page")
  ) {
    return;
  }

  const htmlBase = location.pathname.replace(/\/[^/]*$/, "/");

  function ensureLayoutCss() {
    if (document.querySelector('link[data-mc-layout="1"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("../../shared/css/layout.css", location.href).href;
    link.dataset.mcLayout = "1";
    document.head.appendChild(link);
  }

  function htmlToElement(fragment) {
    const wrap = document.createElement("div");
    wrap.innerHTML = fragment.trim();
    return wrap.firstElementChild;
  }

  async function fetchPartial(name) {
    try {
      const res = await fetch(`${htmlBase}${name}`);
      if (!res.ok) return "";
      return (await res.text()).trim();
    } catch {
      return "";
    }
  }

  async function injectHeader() {
    const zone = zoneMatch[1];
    let headerFile = "header.html";
    if (
      (zone === "Utilisateur" || zone === "Pharmacien") &&
      /\/(login|register|mot-de-passe-oublie|reinitialiser-mot-de-passe)\.html$/i.test(
        location.pathname
      )
    ) {
      headerFile = "header-auth.html";
    }
    const html = await fetchPartial(headerFile);
    if (!html) return;

    const el = htmlToElement(html);
    if (!el) return;

    const existing = document.querySelector(
      "header.site-header, header.app-header, header.dashboard-header.admin-header"
    );
    const appHeaderMount = document.getElementById("app-header");
    if (existing) {
      existing.replaceWith(el);
    } else if (appHeaderMount) {
      appHeaderMount.replaceWith(el);
    } else {
      document.body.insertAdjacentElement("afterbegin", el);
    }
  }

  async function injectAuthBrand() {
    const zone = zoneMatch[1];
    if (zone !== "Utilisateur" && zone !== "Pharmacien") return;
    if (!/\/(login|register)\.html$/i.test(location.pathname)) return;

    const mount = document.getElementById("auth-brand-mount");
    if (!mount) return;

    const html = await fetchPartial("auth-brand.html");
    if (html) mount.innerHTML = html;
  }

  async function injectFooter() {
    if (/\/(login|register)\.html$/i.test(location.pathname)) return;
    if (document.getElementById("mc-zone-footer")) return;
    const html = await fetchPartial("footer.html");
    if (!html) return;

    const el = htmlToElement(html);
    if (!el) return;
    el.id = "mc-zone-footer";

    const firstScript = document.body.querySelector("script");
    if (firstScript) {
      document.body.insertBefore(el, firstScript);
    } else {
      document.body.appendChild(el);
    }
  }

  function rebindLayoutActions() {
    if (typeof getStoredUser !== "function") return;
    const user = getStoredUser();
    const token = localStorage.getItem("token");
    if (!user || !token) return;

    if (user.role === "UTILISATEUR") {
      const initUserAccount = () => {
        if (typeof bindUserHeader === "function") bindUserHeader(user);
        if (window.NotificationCenter) NotificationCenter.init("#notif-center-mount");
      };
      if (document.getElementById("user-account-menu-mount")) {
        if (window.UserAccountMenu) {
          UserAccountMenu.init();
          initUserAccount();
        } else {
          const accountScript = document.createElement("script");
          accountScript.src = new URL("../../shared/js/userAccountMenu.js", location.href).href;
          accountScript.onload = () => {
            UserAccountMenu?.init();
            initUserAccount();
          };
          document.body.appendChild(accountScript);
        }
      } else {
        if (typeof bindUserHeader === "function") bindUserHeader(user);
        const btn = document.getElementById("btn-logout");
        if (btn && !btn.dataset.mcBound && typeof logoutUtilisateur === "function") {
          btn.dataset.mcBound = "1";
          btn.addEventListener("click", logoutUtilisateur);
        }
        if (window.NotificationCenter) NotificationCenter.init("#notif-center-mount");
      }
    }

    if (user.role === "PHARMACIEN") {
      const initPharmaAccount = () => {
        if (typeof bindPharmaHeader === "function") bindPharmaHeader(user);
        if (window.NotificationCenter) NotificationCenter.init("#notif-center-mount");
      };

      if (document.getElementById("user-account-menu-mount")) {
        if (window.UserAccountMenu) {
          UserAccountMenu.init();
          initPharmaAccount();
        } else {
          const accountScript = document.createElement("script");
          accountScript.src = new URL("../../shared/js/userAccountMenu.js", location.href).href;
          accountScript.onload = () => {
            UserAccountMenu?.init();
            initPharmaAccount();
          };
          document.body.appendChild(accountScript);
        }
      } else {
        if (typeof bindPharmaHeader === "function") bindPharmaHeader(user);
        const btn = document.getElementById("btn-logout");
        if (btn && !btn.dataset.mcBound && typeof logoutPharmacien === "function") {
          btn.dataset.mcBound = "1";
          btn.addEventListener("click", logoutPharmacien);
        }
        if (window.NotificationCenter) NotificationCenter.init("#notif-center-mount");
      }
    }

    if (user.role === "ADMIN") {
      const initAdminAccount = () => {
        if (window.UserAccountMenu) UserAccountMenu.init();
        if (window.NotificationCenter) NotificationCenter.init("#notif-center-mount");
      };
      if (document.getElementById("user-account-menu-mount")) {
        if (window.UserAccountMenu && window.NotificationCenter) {
          initAdminAccount();
        } else {
          const accountScript = document.createElement("script");
          accountScript.src = new URL("../../shared/js/userAccountMenu.js", location.href).href;
          accountScript.onload = () => {
            if (!window.NotificationCenter) {
              const notifScript = document.createElement("script");
              notifScript.src = new URL("../../shared/js/notifications.js", location.href).href;
              notifScript.onload = initAdminAccount;
              document.body.appendChild(notifScript);
            } else {
              initAdminAccount();
            }
          };
          document.body.appendChild(accountScript);
        }
      } else if (window.NotificationCenter) {
        NotificationCenter.init("#notif-center-mount");
      }
    }
  }

  async function run() {
    if (window.__mcLayoutDone) return;
    window.__mcLayoutDone = true;
    ensureLayoutCss();
    await injectHeader();
    await injectAuthBrand();
    await injectFooter();

    rebindLayoutActions();

    if (
      zoneMatch[1] === "Public" ||
      zoneMatch[1] === "Utilisateur" ||
      zoneMatch[1] === "Pharmacien" ||
      zoneMatch[1] === "Admin"
    ) {
      await new Promise((resolve) => {
        if (typeof initAppHeader === "function") {
          initAppHeader();
          resolve();
          return;
        }
        const appHeaderScript = document.createElement("script");
        appHeaderScript.src = new URL("../../shared/js/appHeader.js", location.href).href;
        appHeaderScript.onload = () => {
          initAppHeader?.();
          resolve();
        };
        appHeaderScript.onerror = resolve;
        document.body.appendChild(appHeaderScript);
      });
    }

    document.dispatchEvent(new CustomEvent("medicare-layout-ready"));

    const hook = document.createElement("script");
    hook.src = new URL(`../js/HeaderFooter.js`, location.href).href;
    hook.async = true;
    document.body.appendChild(hook);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();

(function autoInitScrollDownHint() {
  if (!isPublicHomePage()) return;

  function boot() {
    initScrollDownHint({ storageKey: "medicare_scroll_hint_public_home" });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

(function loadMediCarePwa() {
  function boot() {
    if (typeof initPwa === "function") initPwa();
  }

  const script = document.createElement("script");
  const commonScript = document.querySelector('script[src*="common.js"]');
  if (commonScript?.src) {
    script.src = new URL("pwa.js", commonScript.src).href;
  } else {
    const origin =
      location.port === "5500" || location.port === "5501"
        ? "http://localhost:3000"
        : location.origin;
    script.src = `${origin}/shared/js/pwa.js`;
  }
  script.onload = boot;
  script.onerror = () => {};
  document.head.appendChild(script);
})();
