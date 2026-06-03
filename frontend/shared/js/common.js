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
  const start = formatPharmacyTime(open);
  const end = formatPharmacyTime(close);
  if (start && end) return `${start} – ${end}`;
  if (start) return `Dès ${start}`;
  if (end) return `Jusqu'à ${end}`;
  return "—";
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
  const hours = formatPharmacyHours(p.heure_ouverture, p.heure_fermeture);
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
  const hours = formatPharmacyHours(p.heure_ouverture, p.heure_fermeture);
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
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
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

/** Ouverte selon horaires ; sans horaires → est_ouverte manuel. */
function isPharmacyOpenBySchedule(p, date = new Date()) {
  const openM = parseScheduleMinutes(p.heure_ouverture);
  const closeM = parseScheduleMinutes(p.heure_fermeture);
  if (openM == null || closeM == null) return null;
  const nowM = date.getHours() * 60 + date.getMinutes();
  if (openM < closeM) return nowM >= openM && nowM < closeM;
  return nowM >= openM || nowM < closeM;
}

function pharmacyIsEffectivelyOpen(p) {
  if (p.est_de_garde) return true;
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

function pharmacyDirectionsButtonHtml(p, options = {}) {
  const url = pharmacyDirectionsUrl(p, options);
  if (!url) return "";
  return ` <a href="${escapeHtml(url)}" class="btn btn-outline btn-small" target="_blank" rel="noopener noreferrer" title="Ouvrir le trajet dans Google Maps">Itinéraire</a>`;
}

function pharmacyLocateButtonHtml(p, options = {}) {
  const url = pharmacyMapUrl(p, options);
  if (!url) return "";
  return ` <a href="${escapeHtml(url)}" class="btn btn-outline btn-small" title="Voir sur la carte MediCare+">Localiser</a>`;
}

function pharmacyLocateAndDirectionsHtml(p, options = {}) {
  return `${pharmacyLocateButtonHtml(p, options)}${pharmacyDirectionsButtonHtml(p, options)}`;
}

function renderPharmacyDetailHero(p, options = {}) {
  const {
    geoQuery = "",
    id,
    backHref = "recherchePharmacie.html",
    backLabel = "← Retour aux résultats",
    showFavori = false,
  } = options;
  const imgUrl = pharmacyImageUrl(p.image);
  const dist =
    p.distance_km != null
      ? `<span class="pharmacy-detail-distance">À ${formatDistance(Number(p.distance_km))}</span>`
      : "";
  const loc = formatQuartierVille(p);
  const hours = formatPharmacyHours(p.heure_ouverture, p.heure_fermeture);
  const gardeRange = formatGardePlanningRange(p.garde_date_debut, p.garde_date_fin);

  const mediaHtml = imgUrl
    ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.nom)}" class="pharmacy-detail-hero__img" />`
    : `<div class="pharmacy-detail-hero__placeholder" aria-hidden="true">🏥</div>`;

  const gardeInfo = p.est_de_garde
    ? `<div class="pharmacy-detail-info-item pharmacy-detail-info-item--garde">
        <span class="pharmacy-detail-info-item__icon" aria-hidden="true">🌙</span>
        <div>
          <span class="pharmacy-detail-info-item__label">Garde</span>
          <strong>${escapeHtml(gardeRange || "En cours")}</strong>
        </div>
      </div>`
    : "";

  const favoriBtn = showFavori
    ? `<button type="button" id="btn-favori" class="btn btn-outline btn-favori pharmacy-detail-action-btn">…</button>`
    : "";

  return `
    <article class="pharmacy-detail-hero card">
      <div class="pharmacy-detail-hero__media">
        ${mediaHtml}
        <div class="pharmacy-detail-hero__overlay">
          <a href="${escapeHtml(backHref)}" class="pharmacy-detail-back">${escapeHtml(backLabel)}</a>
          <div class="pharmacy-detail-hero__badges">${pharmacyBadges(p)} ${dist}</div>
        </div>
      </div>
      <div class="pharmacy-detail-hero__content">
        <h1 class="pharmacy-detail-hero__title">${escapeHtml(p.nom)}</h1>
        ${
          loc !== "—"
            ? `<p class="pharmacy-detail-hero__subtitle">${escapeHtml(loc)}</p>`
            : ""
        }

        <div class="pharmacy-detail-info-grid">
          <div class="pharmacy-detail-info-item">
            <span class="pharmacy-detail-info-item__icon" aria-hidden="true">📍</span>
            <div>
              <span class="pharmacy-detail-info-item__label">Adresse</span>
              <strong>${escapeHtml(p.adresse || "—")}</strong>
            </div>
          </div>
          <div class="pharmacy-detail-info-item">
            <span class="pharmacy-detail-info-item__icon" aria-hidden="true">📞</span>
            <div>
              <span class="pharmacy-detail-info-item__label">Téléphone</span>
              <strong>${escapeHtml(p.telephone || "—")}</strong>
            </div>
          </div>
          <div class="pharmacy-detail-info-item">
            <span class="pharmacy-detail-info-item__icon" aria-hidden="true">🕐</span>
            <div>
              <span class="pharmacy-detail-info-item__label">Horaires</span>
              <strong>${escapeHtml(hours)}</strong>
            </div>
          </div>
          ${gardeInfo}
        </div>

        <div class="pharmacy-detail-actions">
          ${favoriBtn}
          ${
            p.telephone
              ? `<a href="tel:${escapeHtml(String(p.telephone))}" class="btn btn-teal pharmacy-detail-action-btn" data-track-call="${id}">
                  <span aria-hidden="true">📞</span> Appeler
                </a>`
              : ""
          }
          ${pharmacyLocateAndDirectionsHtml(p, { relativeUrl: true, geoQuery })}
        </div>
      </div>
    </article>`;
}

function renderPharmacyStockGrid(stock) {
  if (!stock.length) {
    return '<p class="muted pharmacy-detail-stock-empty">Aucun médicament en stock publié pour le moment.</p>';
  }
  return `<div class="med-results-grid">${stock.map((s) => renderPublicMedicamentStockCard(s)).join("")}</div>`;
}

function renderPharmacyCard(p, options = {}) {
  const isEnhanced = options.zone === "public" || options.zone === "utilisateur";
  const dist =
    p.distance_km != null
      ? `<span class="distance">${formatDistance(Number(p.distance_km))}</span>`
      : options.distanceKm != null
        ? `<span class="distance">${formatDistance(options.distanceKm)}</span>`
        : "";
  const detailUrl = pharmacyDetailUrl(p, options);
  const loc =
    formatQuartierVille(p) !== "—" ? formatQuartierVille(p) : p.adresse || "—";
  const titleExtra = options.titleExtra || "";
  const badgesExtra = options.badgesExtra || "";
  const metaExtra = options.metaExtra || "";
  const clickable = !options.actionsHtml;
  const actionsHtml =
    options.actionsHtml ||
    (isEnhanced
      ? `<a href="${detailUrl}" class="pharmacy-card-link">Voir la fiche <span aria-hidden="true">→</span></a>${pharmacyLocateAndDirectionsHtml(p, options)}`
      : `<a href="${detailUrl}" class="btn btn-teal btn-small">Voir détails</a>${pharmacyLocateAndDirectionsHtml(p, options)}`);
  const cardClasses = [
    "card",
    "pharmacy-card",
    "pharmacy-card-with-img",
    clickable ? "pharmacy-card-clickable" : "",
    isEnhanced ? "pharmacy-card--enhanced" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const clickAttrs = clickable
    ? ` class="${cardClasses}" data-href="${escapeHtml(detailUrl)}" tabindex="0" role="link" aria-label="Voir ${escapeHtml(p.nom)}"`
    : ` class="${cardClasses}"`;

  const hours = formatPharmacyHours(p.heure_ouverture, p.heure_fermeture);
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
          <div class="pharmacy-card-status">${badgesExtra}${pharmacyBadges(p)}</div>
          ${dist ? `<div class="pharmacy-card-distance">${dist}</div>` : ""}
        </div>
      </div>`
    : renderPharmacyThumb(p.image, p.nom);

  const metaBlock = isEnhanced
    ? `<p class="pharmacy-card-meta pharmacy-card-meta--loc">
        <span class="pharmacy-card-meta-icon" aria-hidden="true">📍</span>${escapeHtml(loc)}
      </p>
      <p class="pharmacy-card-meta">
        <span class="pharmacy-card-meta-icon" aria-hidden="true">🕐</span>
        <span class="pharmacy-hours-label">Horaires</span> ${escapeHtml(hours)}
      </p>
      ${p.telephone ? `<p class="pharmacy-card-meta"><span class="pharmacy-card-meta-icon" aria-hidden="true">📞</span>${escapeHtml(p.telephone)}</p>` : ""}
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
  const opts = { ...options };
  const offlineNotice = opts.offlineNotice;
  delete opts.previewLimit;
  delete opts.offlineNotice;

  if (!list.length) {
    container.innerHTML =
      options.emptyHtml || '<p class="muted">Aucune pharmacie trouvée.</p>';
    return;
  }

  const noticeHtml =
    offlineNotice && typeof medicareOfflineNoticeHtml === "function"
      ? medicareOfflineNoticeHtml()
      : "";

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
  if (document.body.classList.contains("admin-auth-page")) return;

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
      /\/(login|register)\.html$/i.test(location.pathname)
    ) {
      headerFile = "header-auth.html";
    }
    const html = await fetchPartial(headerFile);
    if (!html) return;

    const el = htmlToElement(html);
    if (!el) return;

    const existing = document.querySelector(
      "header.site-header, header.dashboard-header.admin-header"
    );
    if (existing) {
      existing.replaceWith(el);
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
      if (document.getElementById("user-account-menu-mount")) {
        if (window.UserAccountMenu) {
          UserAccountMenu.init();
        } else {
          const accountScript = document.createElement("script");
          accountScript.src = new URL("../../shared/js/userAccountMenu.js", location.href).href;
          accountScript.onload = () => UserAccountMenu?.init();
          document.body.appendChild(accountScript);
        }
      } else {
        const btn = document.getElementById("btn-logout");
        if (btn && !btn.dataset.mcBound && typeof logoutAdmin === "function") {
          btn.dataset.mcBound = "1";
          btn.addEventListener("click", logoutAdmin);
        }
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

    if (/pharmacieDetail\.html/i.test(location.pathname)) {
      document.getElementById("btn-back")?.removeAttribute("hidden");
    }

    rebindLayoutActions();

    if (zoneMatch[1] === "Public" || zoneMatch[1] === "Utilisateur") {
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
