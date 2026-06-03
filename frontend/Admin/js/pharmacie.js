const urlParams = new URLSearchParams(window.location.search);
let currentFilter = urlParams.get("statut") || "";
let currentSearch = getAdminSearchCriteria(urlParams);

function showFeedback(text, error = false) {
  const el = document.getElementById("adminMessage");
  if (!el) return;
  el.textContent = text;
  el.className = error ? "admin-feedback error" : "admin-feedback success";
}

function showSearchFeedback(text, error = false) {
  const el = document.getElementById("searchFormMessage");
  if (!el) return;
  el.textContent = text;
  el.className = error ? "admin-feedback error" : "admin-feedback success";
}

function listBackUrl() {
  return encodeURIComponent(`pharmacie.html?${buildAdminSearchQueryString(currentSearch, currentFilter)}`);
}

function syncListUrl() {
  const newUrl = new URL(window.location.href);
  if (currentFilter) newUrl.searchParams.set("statut", currentFilter);
  else newUrl.searchParams.delete("statut");
  ["pharmacien", "pharmacie", "ville"].forEach((key) => {
    if (currentSearch[key]) newUrl.searchParams.set(key, currentSearch[key]);
    else newUrl.searchParams.delete(key);
  });
  window.history.replaceState({}, "", newUrl);
}

function activateFilterButton(statut) {
  document.querySelectorAll(".admin-filter-btn").forEach((btn) => {
    const s = btn.getAttribute("data-statut") ?? "";
    btn.classList.toggle("active", s === statut);
  });
}

function describeSearchHint() {
  const parts = [];
  if (currentSearch.pharmacien) parts.push(`pharmacien « ${currentSearch.pharmacien} »`);
  if (currentSearch.pharmacie) parts.push(`pharmacie « ${currentSearch.pharmacie} »`);
  if (currentSearch.ville) parts.push(`ville « ${currentSearch.ville} »`);
  return parts.length ? ` — ${parts.join(", ")}` : "";
}

async function loadPharmacies(statut = currentFilter) {
  const list = document.getElementById("pharmaciesList");
  const count = document.getElementById("pharmaciesCount");
  if (!list) return;

  currentFilter = statut;
  syncListUrl();
  activateFilterButton(statut);

  list.innerHTML = '<p class="admin-loading">Chargement…</p>';
  showFeedback("");

  const labels = {
    "": "toutes les pharmacies",
    en_attente: "en attente",
    valide: "validées",
    refuse: "refusées",
  };

  try {
    let pharmacies;
    if (hasAdminSearchCriteria(currentSearch)) {
      pharmacies = await MediCareAPI.searchAdminPharmacies(currentSearch);
      if (statut) pharmacies = pharmacies.filter((p) => p.statut === statut);
    } else {
      pharmacies = await MediCareAPI.getAdminPharmacies(statut);
    }

    const searchHint = describeSearchHint();

    if (count) {
      count.textContent =
        pharmacies.length === 0
          ? `Aucune pharmacie ${labels[statut] || ""}${searchHint}`
          : `${pharmacies.length} pharmacie(s) ${labels[statut] || ""}${searchHint}`;
    }

    if (!pharmacies.length) {
      list.innerHTML = `
        <div class="admin-empty">
          <span class="admin-empty-icon">${hasAdminSearchCriteria(currentSearch) ? "🔍" : "💊"}</span>
          <p>${
            hasAdminSearchCriteria(currentSearch)
              ? "Aucune pharmacie ne correspond à cette recherche."
              : "Aucune pharmacie pour ce filtre."
          }</p>
        </div>`;
      return;
    }

    const back = listBackUrl();
    list.innerHTML = pharmacies
      .map((p) => adminRenderPharmacyRow(p, adminPharmacyDetailUrl(p.id, back)))
      .join("");
  } catch (err) {
    list.innerHTML = "";
    showFeedback(err.message, true);
  }
}

function setFilter(btn, statut) {
  loadPharmacies(statut);
}

window.setFilter = setFilter;

function initAdminSearchForm() {
  const form = document.getElementById("adminSearchForm");
  if (!form) return;

  fillAdminSearchForm(currentSearch);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    currentSearch = readAdminSearchForm();

    if (!hasAdminSearchCriteria(currentSearch)) {
      showSearchFeedback("Indiquez au moins un critère (pharmacien, pharmacie ou ville).", true);
      return;
    }

    showSearchFeedback("");
    loadPharmacies(currentFilter);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (!initAdminPage()) return;
  initAdminSearchForm();
  loadPharmacies(currentFilter);

  if (location.hash === "#adminSearchSection") {
    document.getElementById("adminSearchSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
