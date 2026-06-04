const params = new URLSearchParams(window.location.search);
const pharmacyId = params.get("id");
const backUrl = params.get("back") ? decodeURIComponent(params.get("back")) : "pharmacie.html";

if (!pharmacyId) {
  window.location.href = "Dashboard.html";
}

function showMessage(text, error = false) {
  const el = document.getElementById("detailMessage");
  if (!el) return;
  el.textContent = text;
  el.className = error ? "admin-feedback error" : "admin-feedback success";
}

function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

function openModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

window.closeModal = closeModal;
window.openModal = openModal;

function adminStatutChip(statut) {
  const cls =
    statut === "valide"
      ? "admin-detail-chip--valide"
      : statut === "refuse"
        ? "admin-detail-chip--refuse"
        : "admin-detail-chip--attente";
  return `<span class="admin-detail-chip ${cls}">${escapeHtml(adminStatutLabel(statut))}</span>`;
}

function adminPharmacyThumbHtml(image, nom) {
  const imgUrl = pharmacyImageUrl(image);
  if (imgUrl) {
    return `<button type="button" class="admin-pharmacy-detail__thumb admin-pharmacy-detail__thumb--photo"
      data-pharmacy-photo="${escapeHtml(imgUrl)}" data-pharmacy-photo-title="${escapeHtml(nom || "Pharmacie")}"
      aria-label="Agrandir la photo">
      <img src="${escapeHtml(imgUrl)}" alt="" />
    </button>`;
  }
  return `<div class="admin-pharmacy-detail__thumb" aria-hidden="true"><span>🏥</span></div>`;
}

function renderAdminPharmacyHero(p) {
  const loc = formatQuartierVille(p);
  const gardeRange = formatGardePlanningRange(p.garde_date_debut, p.garde_date_fin);
  const hoursBlock =
    typeof pharmacyDetailHoursFactsHtml === "function"
      ? pharmacyDetailHoursFactsHtml(p, { highlightToday: false })
      : "";

  return `
    <div class="admin-pharmacy-detail__identity">
      ${adminPharmacyThumbHtml(p.image, p.nom)}
      <div class="admin-pharmacy-detail__meta">
        <h2 class="admin-pharmacy-detail__title">${escapeHtml(p.nom)}</h2>
        ${loc !== "—" ? `<p class="admin-pharmacy-detail__loc">${escapeHtml(loc)}</p>` : ""}
        <div class="admin-pharmacy-detail__chips">
          ${adminStatutChip(p.statut)}
          ${pharmacyChipBadges(p)}
        </div>
      </div>
    </div>
    <ul class="pharmacy-detail-sheet__facts admin-pharmacy-detail__facts">
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
      ${hoursBlock}
      ${
        p.est_de_garde
          ? `<li>
        <span class="pharmacy-detail-sheet__fact-icon" aria-hidden="true">🌙</span>
        <span class="pharmacy-detail-sheet__fact-label">Garde</span>
        <strong>${escapeHtml(gardeRange || "En cours")}</strong>
      </li>`
          : ""
      }
      <li>
        <span class="pharmacy-detail-sheet__fact-icon" aria-hidden="true">📅</span>
        <span class="pharmacy-detail-sheet__fact-label">Création</span>
        <strong>${escapeHtml(adminFormatDate(p.date_creation))}</strong>
      </li>
    </ul>
    ${adminPharmacyLocationSectionHtml(p)}`;
}

function adminPharmacyLocationSectionHtml(p) {
  const hasCoords = pharmacyHasCoordinates(p);
  return `
    <section class="admin-pharmacy-location" aria-labelledby="admin-pharmacy-location-title">
      <h3 id="admin-pharmacy-location-title" class="admin-subtitle">Localisation</h3>
      <div id="adminPharmacyMapHost" class="admin-pharmacy-map-host"${
        !hasCoords ? ' data-empty="1"' : ""
      }></div>
    </section>`;
}

function renderPharmacienBlock(p, container) {
  if (!container) return;
  const compteRefuse = adminPharmacienStatutLabel(p.pharmacien_statut);
  container.innerHTML = `
    <h3 class="admin-subtitle">Pharmacien propriétaire</h3>
    <div class="admin-info-grid">
      <div class="admin-info-item">
        <span>Nom</span>
        <strong>${escapeHtml(p.pharmacien_nom || "—")}</strong>
      </div>
      <div class="admin-info-item">
        <span>Email</span>
        <strong>${escapeHtml(p.pharmacien_email || "—")}</strong>
      </div>
      ${
        compteRefuse
          ? `<div class="admin-info-item admin-info-wide">
        <span>Compte pharmacien</span>
        <strong>${escapeHtml(compteRefuse)}</strong>
        <span class="muted admin-info-hint">La visibilité publique dépend du statut de validation de la pharmacie.</span>
      </div>`
          : ""
      }
      <div class="admin-info-item">
        <span>Inscription</span>
        <strong>${escapeHtml(adminFormatDate(p.pharmacien_date_creation))}</strong>
      </div>
    </div>`;
}

async function loadPharmacyDetail() {
  const detail = document.getElementById("pharmacyDetail");
  const pharmaBox = document.getElementById("pharmacienSection");
  const stockBox = document.getElementById("stockSection");
  const actionsBox = document.getElementById("actionsSection");

  try {
    const p = await MediCareAPI.getAdminPharmacy(pharmacyId);
    document.title = `${p.nom} — Admin MediCare+`;
    detail.innerHTML = renderAdminPharmacyHero(p);
    mountPharmacyLocationMap(document.getElementById("adminPharmacyMapHost"), p, {
      mapClass: "pharmacy-location-map admin-pharmacy-location-map",
    });
    renderPharmacienBlock(p, pharmaBox);
    adminRenderStock(p.stock || [], stockBox);
    adminRenderActions(p.statut, actionsBox);
    initPharmacyDetailPhotoZoom();
  } catch (err) {
    detail.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

async function confirmValider() {
  closeModal("modalValider");
  try {
    const data = await MediCareAPI.validateAdminPharmacy(pharmacyId);
    showMessage(data.message || "Pharmacie validée");
    window.NotificationCenter?.refresh?.();
    setTimeout(() => {
      window.location.href = backUrl;
    }, 800);
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function confirmRefuser() {
  closeModal("modalRefuser");
  try {
    const data = await MediCareAPI.refuseAdminPharmacy(pharmacyId);
    showMessage(data.message || "Pharmacie refusée");
    window.NotificationCenter?.refresh?.();
    setTimeout(() => {
      window.location.href = backUrl;
    }, 800);
  } catch (err) {
    showMessage(err.message, true);
  }
}

window.confirmValider = confirmValider;
window.confirmRefuser = confirmRefuser;

document.addEventListener("DOMContentLoaded", () => {
  if (!initAdminPage()) return;
  initAdminStockPanel();
  initPharmacyDetailHoursToggle();
  const backLink = document.getElementById("admin-detail-back-link");
  if (backLink) backLink.href = backUrl;
  loadPharmacyDetail();
});
