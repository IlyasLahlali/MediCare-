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

function adminPharmacyDetailUrl(id, backUrl) {
  const q = new URLSearchParams({ id: String(id) });
  if (backUrl) q.set("back", backUrl);
  return `pharmacieDetail.html?${q}`;
}

function adminRenderPharmacyRow(p, detailHref) {
  const loc =
    p.quartier && p.ville ? `${escapeHtml(p.quartier)}, ${escapeHtml(p.ville)}` : escapeHtml(p.adresse);
  const rowClass =
    p.statut === "valide"
      ? "admin-row row-valide"
      : p.statut === "refuse"
        ? "admin-row row-refuse"
        : "admin-row row-attente";

  const thumb =
    typeof renderPharmacyThumb === "function"
      ? renderPharmacyThumb(p.image, p.nom)
      : "";

  return `
    <article class="${rowClass} admin-row-with-img">
      ${thumb}
      <div class="admin-row-info">
        <h3>${escapeHtml(p.nom)}</h3>
        <p class="admin-row-meta">📍 ${loc}</p>
        <p class="admin-row-meta">👤 ${escapeHtml(p.pharmacien_nom || "—")} · ${escapeHtml(p.pharmacien_email || "")}</p>
        <p class="admin-row-meta">📦 ${p.nb_stock ?? 0} médicament(s) en stock</p>
        <span class="admin-badge ${adminStatutClass(p.statut)}">${adminStatutLabel(p.statut)}</span>
      </div>
      <button type="button" class="btn-primary admin-btn-detail" onclick="window.location.href='${detailHref}'">
        Voir détails →
      </button>
    </article>`;
}

window.adminStatutLabel = adminStatutLabel;
window.adminStatutClass = adminStatutClass;
window.adminPharmacyDetailUrl = adminPharmacyDetailUrl;
window.adminRenderPharmacyRow = adminRenderPharmacyRow;

function getAdminSearchCriteria(params = new URLSearchParams(window.location.search)) {
  return {
    pharmacien: params.get("pharmacien")?.trim() || "",
    pharmacie: params.get("pharmacie")?.trim() || "",
    ville: params.get("ville")?.trim() || "",
  };
}

function hasAdminSearchCriteria(criteria) {
  return !!(criteria.pharmacien || criteria.pharmacie || criteria.ville);
}

function buildAdminSearchQueryString(criteria, statut = "") {
  const q = new URLSearchParams();
  if (statut) q.set("statut", statut);
  if (criteria.pharmacien) q.set("pharmacien", criteria.pharmacien);
  if (criteria.pharmacie) q.set("pharmacie", criteria.pharmacie);
  if (criteria.ville) q.set("ville", criteria.ville);
  return q.toString();
}

function fillAdminSearchForm(criteria) {
  const pharmacien = document.getElementById("searchPharmacien");
  const pharmacie = document.getElementById("searchPharmacie");
  const ville = document.getElementById("searchVille");
  if (pharmacien) pharmacien.value = criteria.pharmacien;
  if (pharmacie) pharmacie.value = criteria.pharmacie;
  if (ville) ville.value = criteria.ville;
}

function readAdminSearchForm() {
  return {
    pharmacien: document.getElementById("searchPharmacien")?.value.trim() || "",
    pharmacie: document.getElementById("searchPharmacie")?.value.trim() || "",
    ville: document.getElementById("searchVille")?.value.trim() || "",
  };
}

window.getAdminSearchCriteria = getAdminSearchCriteria;
window.hasAdminSearchCriteria = hasAdminSearchCriteria;
window.buildAdminSearchQueryString = buildAdminSearchQueryString;
window.fillAdminSearchForm = fillAdminSearchForm;
window.readAdminSearchForm = readAdminSearchForm;
