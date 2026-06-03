function initHeroSearchTabs() {
  const tabs = document.querySelectorAll("[data-hero-tab]");
  const panels = {
    pharmacy: document.getElementById("hero-panel-pharmacy"),
    medicament: document.getElementById("hero-panel-medicament"),
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.heroTab;
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });
      Object.entries(panels).forEach(([k, panel]) => {
        if (!panel) return;
        const show = k === key;
        panel.hidden = !show;
        panel.classList.toggle("is-hidden", !show);
      });
    });
  });
}

function formatPublicStat(n) {
  return new Intl.NumberFormat("fr-FR").format(Number(n) || 0);
}

function renderPublicStats(stats) {
  const grid = document.getElementById("public-stats-grid");
  if (!grid) return;

  const items = [
    {
      icon: "🏥",
      value: formatPublicStat(stats.pharmacies),
      label: "Pharmacies référencées",
    },
    {
      icon: "🔍",
      value: formatPublicStat(stats.recherches_mois),
      label: "Recherches ce mois",
    },
    {
      icon: "🗺️",
      value: formatPublicStat(stats.villes),
      label: "Villes couvertes",
    },
    {
      icon: "🌐",
      value: "24/7",
      valueClass: "public-stat-card__value--text",
      label: "Service disponible en ligne",
      highlight: true,
    },
  ];

  grid.innerHTML = items
    .map(
      (item) => `
    <article class="public-stat-card${item.highlight ? " public-stat-card--highlight" : ""}">
      <span class="public-stat-card__icon" aria-hidden="true">${item.icon}</span>
      <span class="public-stat-card__value${item.valueClass ? ` ${item.valueClass}` : ""}">${item.value}</span>
      <span class="public-stat-card__label">${item.label}</span>
    </article>`
    )
    .join("");
}

async function loadPublicStats() {
  const grid = document.getElementById("public-stats-grid");
  if (!grid) return;
  try {
    const stats = await MediCareAPI.getPublicStats();
    renderPublicStats(stats);
  } catch {
    grid.innerHTML =
      '<p class="muted public-stats__loading">Statistiques indisponibles pour le moment.</p>';
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  initHeroSearchTabs();
  bindMedicamentSearchForm("search-medicament-form", "public");
  loadPublicStats();

  const geoStatus = document.getElementById("geo-status");
  const nearbyList = document.getElementById("nearby-list");
  const form = document.getElementById("search-pharmacy-form");
  const btnPosition = document.getElementById("btn-use-position");

  const { geo, ville } = await resolveSearchContext();
  if (geo) {
    geoStatus.textContent = `Position active — recherche optimisée par proximité.`;
  } else {
    geoStatus.textContent =
      "Activez la géolocalisation pour les pharmacies les plus proches.";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = readPharmacySearchForm();
    if (!formData.ville && ville) formData.ville = ville;
    const params = pharmacySearchToParams(formData, geo);
    if (document.getElementById("filter-ouvertes")?.checked) {
      params.set("ouvertes", "1");
    }
    if (document.getElementById("filter-garde")?.checked) {
      params.set("garde", "1");
    }
    window.location.href = `recherchePharmacie.html?${params.toString()}`;
  });

  btnPosition?.addEventListener("click", async () => {
    geoStatus.textContent = "Actualisation de votre position…";
    try {
      const pos = await getUserPosition();
      if (!pos) {
        geoStatus.textContent =
          "Géolocalisation refusée — choisissez une ville ou autorisez la position.";
        return;
      }
      const { geo: g, ville: v } = await resolveSearchContext();
      if (g) {
        geoStatus.textContent = `Position mise à jour — ${v ? `ville : ${v}` : "recherche à proximité"}.`;
      }
      document.getElementById("pharmacies-proches")?.scrollIntoView({ behavior: "smooth" });
      await loadNearbyList(nearbyList, g || pos, v);
    } catch (err) {
      geoStatus.textContent = err.message;
    }
  });

  const villeSelect = document.getElementById("search-ville");
  villeSelect?.addEventListener("change", async () => {
    const v = villeSelect.value;
    if (v) setStoredAutoVille(v);
    await loadPharmacyFilterSelects(v);
  });

  await loadNearbyList(nearbyList, geo, ville);
});

async function loadNearbyList(nearbyList, geo, ville) {
  if (!nearbyList) return;
  nearbyList.innerHTML = '<p class="muted">Chargement…</p>';
  try {
    const list = await MediCareAPI.getPharmacies(apiParamsFromSearch({ ville }, geo, true));
    const geoQuery = geo ? `&lat=${geo.lat}&lon=${geo.lon}` : "";
    mountPharmacyList(nearbyList, list, {
      geoQuery,
      zone: "public",
      relativeUrl: true,
      previewLimit: 6,
      offlineNotice: list._offlineCache,
      emptyHtml: '<p class="muted">Aucune pharmacie ouverte à proximité pour le moment.</p>',
    });
  } catch (err) {
    nearbyList.innerHTML = `<p class="error">${err.message}</p>`;
  }
}
