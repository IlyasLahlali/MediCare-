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
  if (statut === "VALIDE") return "Compte validé";
  if (statut === "REFUSE") return "Compte refusé";
  return "En attente de validation";
}

function adminRenderStock(stock, container) {
  if (!container) return;
  if (!stock?.length) {
    container.innerHTML =
      '<h3 class="admin-subtitle">Stock médicaments</h3><p class="muted">Aucun médicament en stock.</p>';
    return;
  }
  container.innerHTML =
    '<h3 class="admin-subtitle">Stock médicaments</h3><div class="admin-chambres-grid">' +
    stock
      .map(
        (s) => `
      <div class="admin-chambre-card">
        <strong>${escapeHtml(s.nom)}</strong>
        <span>${s.disponible ? "Disponible" : "Rupture"}</span>
        <span>${s.prix != null ? `${s.prix} DH` : "—"}</span>
      </div>`
      )
      .join("") +
    "</div>";
}

function adminRenderActions(statut, container) {
  if (!container) return;

  if (statut === "en_attente") {
    container.innerHTML = `
      <h3 class="admin-subtitle">Actions</h3>
      <div class="admin-detail-actions">
        <button type="button" class="btn-primary" onclick="openModal('modalValider')">Valider la pharmacie</button>
        <button type="button" class="btn-danger" onclick="openModal('modalRefuser')">Refuser la pharmacie</button>
      </div>`;
    return;
  }

  if (statut === "valide") {
    container.innerHTML = `
      <h3 class="admin-subtitle">Actions</h3>
      <div class="admin-status-banner banner-valide">
        Cette pharmacie est validée et visible sur MediCare+.
      </div>`;
    return;
  }

  container.innerHTML = `
    <h3 class="admin-subtitle">Actions</h3>
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
window.adminRenderActions = adminRenderActions;
window.adminFormatDate = adminFormatDate;
