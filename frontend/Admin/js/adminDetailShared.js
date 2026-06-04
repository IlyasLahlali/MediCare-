function adminStatutLabel(statut) {
  if (statut === "valide") return "Validée";
  if (statut === "refuse") return "Refusée";
  return "En attente";
}

function adminStatutClass(statut) {
  if (statut === "valide") return "badge-valide";
  if (statut === "refuse") return "badge-refuse";
  return "badge-attente";
}

function adminPharmacienStatutLabel(statut) {
  if (statut === "REFUSE") return "Compte refusé — accès bloqué";
  return "";
}

function adminStockItemHtml(s) {
  const disponible = !!s.disponible;
  const statusCls = disponible ? "admin-stock-status--ok" : "admin-stock-status--out";
  return `
    <div class="admin-chambre-card admin-stock-item">
      <strong>${escapeHtml(s.nom || "—")}</strong>
      <span class="admin-stock-status ${statusCls}">${disponible ? "Disponible" : "Rupture"}</span>
      <span class="admin-stock-price">${s.prix != null ? `${escapeHtml(String(s.prix))} DH` : "—"}</span>
    </div>`;
}

function adminRenderStock(stock, container) {
  if (!container) return;
  const items = Array.isArray(stock) ? stock : [];
  const count = items.length;
  const countLabel = `${count} médicament${count > 1 ? "s" : ""}`;

  if (!count) {
    container.innerHTML = `
      <div class="admin-stock-head">
        <h3 class="admin-subtitle admin-stock-head__title">Stock médicaments</h3>
      </div>
      <p class="muted admin-stock-empty">Aucun médicament en stock.</p>`;
    return;
  }

  const gridHtml = items.map(adminStockItemHtml).join("");

  container.innerHTML = `
    <div class="admin-stock-head">
      <h3 class="admin-subtitle admin-stock-head__title">Stock médicaments</h3>
      <span class="admin-stock-badge" aria-label="${escapeHtml(countLabel)}">${escapeHtml(countLabel)}</span>
      <button
        type="button"
        class="admin-stock-toggle-btn"
        data-admin-stock-toggle
        aria-expanded="false"
        aria-controls="adminStockPanel"
      >
        <span class="admin-stock-toggle-btn__icon" aria-hidden="true">📦</span>
        <span class="admin-stock-toggle-btn__label">Voir tout le stock</span>
        <span class="admin-stock-toggle-btn__chevron" aria-hidden="true">▼</span>
      </button>
    </div>
    <div id="adminStockPanel" class="admin-stock-panel" data-admin-stock-panel hidden>
      <div class="admin-chambres-grid admin-stock-panel__grid">${gridHtml}</div>
    </div>`;
}

function initAdminStockPanel() {
  if (window._adminStockPanelBound) return;
  window._adminStockPanelBound = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-admin-stock-toggle]");
    if (!btn) return;
    const panel = btn.closest("#stockSection")?.querySelector("[data-admin-stock-panel]");
    if (!panel) return;
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.classList.toggle("is-open", open);
    const label = btn.querySelector(".admin-stock-toggle-btn__label");
    if (label) label.textContent = open ? "Masquer le stock" : "Voir tout le stock";
  });
}

function adminRenderActions(statut, container) {
  if (!container) return;

  if (statut === "en_attente") {
    container.innerHTML = `
      <div class="admin-detail-actions">
        <button type="button" class="btn-primary" onclick="openModal('modalValider')">Valider la pharmacie</button>
        <button type="button" class="btn-danger" onclick="openModal('modalRefuser')">Refuser la pharmacie</button>
      </div>`;
    return;
  }

  if (statut === "valide") {
    container.innerHTML = `
      <div class="admin-status-banner banner-valide">
        Cette pharmacie est validée et visible sur MediCare+.
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="admin-status-banner banner-refuse">
      Cette pharmacie a été refusée. Aucune action possible.
    </div>`;
}

function adminFormatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

window.adminStatutLabel = adminStatutLabel;
window.adminStatutClass = adminStatutClass;
window.adminPharmacienStatutLabel = adminPharmacienStatutLabel;
window.adminRenderStock = adminRenderStock;
window.initAdminStockPanel = initAdminStockPanel;
window.adminRenderActions = adminRenderActions;
window.adminFormatDate = adminFormatDate;
