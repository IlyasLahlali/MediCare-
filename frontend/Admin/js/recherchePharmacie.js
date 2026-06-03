const urlParams = new URLSearchParams(window.location.search);

function showSearchMessage(text, error = false) {
  const el = document.getElementById("searchMessage");
  if (!el) return;
  el.textContent = text;
  el.className = error ? "admin-feedback error" : "admin-feedback success";
}

function searchDetailHref(pharmacyId) {
  const criteria = getAdminSearchCriteria(urlParams);
  const back = encodeURIComponent(`pharmacie.html?${buildAdminSearchQueryString(criteria)}`);
  return adminPharmacyDetailUrl(pharmacyId, back);
}

function describeCriteria(criteria) {
  const parts = [];
  if (criteria.pharmacien) parts.push(`pharmacien « ${criteria.pharmacien} »`);
  if (criteria.pharmacie) parts.push(`pharmacie « ${criteria.pharmacie} »`);
  if (criteria.ville) parts.push(`ville « ${criteria.ville} »`);
  return parts.join(", ");
}

async function runSearch(criteria) {
  const list = document.getElementById("searchResults");
  const summary = document.getElementById("searchSummary");
  if (!list) return;

  if (!hasAdminSearchCriteria(criteria)) {
    list.innerHTML = "";
    if (summary) summary.textContent = "";
    showSearchMessage("Aucun critère dans l’URL. Utilisez le formulaire de recherche.", true);
    return;
  }

  list.innerHTML = '<p class="admin-loading">Chargement…</p>';
  showSearchMessage("");

  try {
    const pharmacies = await MediCareAPI.searchAdminPharmacies(criteria);

    if (summary) {
      summary.textContent =
        pharmacies.length === 0
          ? `Aucun résultat pour ${describeCriteria(criteria)}`
          : `${pharmacies.length} résultat(s) — ${describeCriteria(criteria)}`;
    }

    if (!pharmacies.length) {
      list.innerHTML = `
        <div class="admin-empty">
          <span class="admin-empty-icon">🔍</span>
          <p>Aucune pharmacie ne correspond à cette recherche.</p>
        </div>`;
      return;
    }

    list.innerHTML = pharmacies
      .map((p) => adminRenderPharmacyRow(p, searchDetailHref(p.id)))
      .join("");
  } catch (err) {
    list.innerHTML = "";
    showSearchMessage(err.message, true);
  }
}

function initSearchForm() {
  const form = document.getElementById("adminSearchForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const criteria = readAdminSearchForm();

    if (!hasAdminSearchCriteria(criteria)) {
      showSearchMessage("Indiquez au moins un critère.", true);
      return;
    }

    window.location.href = `pharmacie.html?${buildAdminSearchQueryString(criteria)}`;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (!initAdminPage()) return;

  const criteria = getAdminSearchCriteria(urlParams);
  fillAdminSearchForm(criteria);
  initSearchForm();
  runSearch(criteria);
});
