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

function renderPharmacienBlock(p, container) {
  if (!container) return;
  container.innerHTML = `
    <h3 class="admin-subtitle">Pharmacien propriétaire</h3>
    <div class="admin-info-grid">
      <div class="admin-info-item"><span>Nom</span><strong>${escapeHtml(p.pharmacien_nom || "—")}</strong></div>
      <div class="admin-info-item"><span>Email</span><strong>${escapeHtml(p.pharmacien_email || "—")}</strong></div>
      <div class="admin-info-item"><span>Statut compte</span><strong>${escapeHtml(adminPharmacienStatutLabel(p.pharmacien_statut))}</strong></div>
      <div class="admin-info-item"><span>Inscription</span><strong>${adminFormatDate(p.pharmacien_date_creation)}</strong></div>
      <div class="admin-info-item"><span>ID pharmacien</span><strong>#${p.pharmacien_id ?? "—"}</strong></div>
    </div>`;
}

async function loadPharmacyDetail() {
  const detail = document.getElementById("pharmacyDetail");
  const pharmaBox = document.getElementById("pharmacienSection");
  const stockBox = document.getElementById("stockSection");
  const actionsBox = document.getElementById("actionsSection");

  try {
    const p = await MediCareAPI.getAdminPharmacy(pharmacyId);
    const imgUrl = pharmacyImageUrl(p.image);
    const imgBlock = imgUrl ? `<img src="${imgUrl}" alt="" class="admin-detail-img" />` : "";

    detail.innerHTML = `
      ${imgBlock}
      <div class="admin-detail-header">
        <h2>${escapeHtml(p.nom)}</h2>
        <span class="admin-badge ${adminStatutClass(p.statut)}">${adminStatutLabel(p.statut)}</span>
      </div>
      <h3 class="admin-subtitle">Informations pharmacie</h3>
      <div class="admin-info-grid">
        <div class="admin-info-item"><span>Ville</span><strong>${escapeHtml(p.ville || "—")}</strong></div>
        <div class="admin-info-item"><span>Quartier</span><strong>${escapeHtml(p.quartier || "—")}</strong></div>
        <div class="admin-info-item admin-info-wide"><span>Adresse</span><strong>${escapeHtml(p.adresse)}</strong></div>
        <div class="admin-info-item"><span>Téléphone</span><strong>${escapeHtml(p.telephone || "—")}</strong></div>
        <div class="admin-info-item"><span>Horaires</span><strong>${escapeHtml(p.heure_ouverture || "—")} – ${escapeHtml(p.heure_fermeture || "—")}</strong></div>
        <div class="admin-info-item"><span>Ouverte</span><strong>${p.est_ouverte ? "Oui" : "Non"}</strong></div>
        <div class="admin-info-item"><span>De garde</span><strong>${p.est_de_garde ? "Oui" : "Non"}</strong></div>
        <div class="admin-info-item"><span>Active (publiée)</span><strong>${p.est_active ? "Oui" : "Non"}</strong></div>
        <div class="admin-info-item"><span>Statut admin</span><strong>${adminStatutLabel(p.statut)}</strong></div>
        <div class="admin-info-item"><span>Coordonnées GPS</span><strong>${p.latitude != null && p.longitude != null ? `${p.latitude}, ${p.longitude}` : "—"}</strong></div>
        <div class="admin-info-item"><span>Création</span><strong>${adminFormatDate(p.date_creation)}</strong></div>
      </div>`;

    renderPharmacienBlock(p, pharmaBox);
    adminRenderStock(p.stock || [], stockBox);
    adminRenderActions(p.statut, actionsBox);
  } catch (err) {
    detail.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

async function confirmValider() {
  closeModal("modalValider");
  try {
    const data = await MediCareAPI.validateAdminPharmacy(pharmacyId);
    showMessage(data.message || "Pharmacie validée");
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
  document.getElementById("btn-back")?.addEventListener("click", () => {
    window.location.href = backUrl;
  });
  loadPharmacyDetail();
});
