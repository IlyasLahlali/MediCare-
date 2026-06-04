const urlParams = new URLSearchParams(window.location.search);
let currentFilter = urlParams.get("statut") || "";
let currentSearch = urlParams.get("q") || "";
let allPharmacies = [];

const FILTER_LABELS = {
  "": "toutes vos pharmacies",
  valide: "validées",
  en_attente: "en attente de validation",
  refuse: "refusées",
};

function activateFilterButton(statut) {
  document.querySelectorAll(".pharma-filter-btn").forEach((btn) => {
    const s = btn.getAttribute("data-statut") ?? "";
    btn.classList.toggle("active", s === statut);
  });
}

function renderPharmacyCards(list) {
  return list
    .map((p) =>
      renderPharmacyCard(p, {
        relativeUrl: true,
        zone: "pharmacien",
        cardClickable: true,
        badgesExtra: pharmaValidationBadgeHtml(p),
        metaExtra: typeof pharmaOwnerCardMetaExtra === "function" ? pharmaOwnerCardMetaExtra(p) : "",
        actionsHtml: pharmaPharmacyCardActions(p),
      })
    )
    .join("");
}

function pharmacyMatchesSearch(p, q) {
  if (!q) return true;
  const haystack = [p.nom, p.adresse, p.quartier, p.ville]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q.toLowerCase());
}

function applyFilter(statut = currentFilter) {
  const listEl = document.getElementById("pharmacy-list");
  const countEl = document.getElementById("pharmacy-count");

  currentFilter = statut;
  const newUrl = new URL(window.location.href);
  if (statut) newUrl.searchParams.set("statut", statut);
  else newUrl.searchParams.delete("statut");
  if (currentSearch) newUrl.searchParams.set("q", currentSearch);
  else newUrl.searchParams.delete("q");
  window.history.replaceState({}, "", newUrl);
  activateFilterButton(statut);

  let filtered = statut
    ? allPharmacies.filter((p) => pharmaValidationStatut(p) === statut)
    : allPharmacies;

  if (currentSearch) {
    filtered = filtered.filter((p) => pharmacyMatchesSearch(p, currentSearch));
  }

  const filterLabel = FILTER_LABELS[statut] || "";
  const searchHint = currentSearch ? ` pour « ${currentSearch} »` : "";

  if (countEl) {
    countEl.textContent =
      filtered.length === 0
        ? `Aucune pharmacie ${filterLabel}${searchHint}`
        : `${filtered.length} pharmacie${filtered.length > 1 ? "s" : ""} ${filterLabel}${searchHint}`;
  }

  if (!allPharmacies.length) {
    listEl.innerHTML =
      '<p class="muted">Aucune pharmacie. <a href="ajouterPharmacie.html">Ajouter une pharmacie</a></p>';
    return;
  }

  if (!filtered.length) {
    listEl.className = "";
    listEl.innerHTML = currentSearch
      ? `<p class="muted">Aucun résultat pour « ${escapeHtml(currentSearch)} »${statut ? " avec ce filtre." : "."}</p>`
      : '<p class="muted">Aucune pharmacie pour ce filtre.</p>';
    return;
  }

  listEl.className = "pharmacy-list pharma-owner-list";
  listEl.innerHTML = renderPharmacyCards(filtered);
  bindPharmacyCardClicks(listEl);
}

async function loadPharmacies() {
  const listEl = document.getElementById("pharmacy-list");
  listEl.innerHTML = '<p class="muted">Chargement…</p>';
  try {
    allPharmacies = await MediCareAPI.getPharmaPharmacies();
    applyFilter(currentFilter);
  } catch (err) {
    listEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!initPharmaPage()) return;
  GardePharma.ensureModal();

  const searchInput = document.getElementById("pharmacy-search-q");
  if (searchInput && currentSearch) searchInput.value = currentSearch;

  document.getElementById("pharmacy-search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    currentSearch = searchInput?.value.trim() || "";
    applyFilter(currentFilter);
  });

  searchInput?.addEventListener("search", () => {
    if (searchInput.value === "") {
      currentSearch = "";
      applyFilter(currentFilter);
    }
  });

  activateFilterButton(currentFilter);

  document.querySelectorAll(".pharma-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyFilter(btn.getAttribute("data-statut") ?? "");
    });
  });

  const listEl = document.getElementById("pharmacy-list");
  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-garde-id]");
    if (!btn) return;
    GardePharma.openForPharmacy(btn.dataset.gardeId, btn.dataset.gardeNom, {
      onSuccess: loadPharmacies,
    });
  });

  loadPharmacies();
});
