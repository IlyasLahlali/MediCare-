async function loadResults() {
  if (!initUtilisateurPage()) return;

  const urlParams = new URLSearchParams(location.search);
  let form = {
    nom: urlParams.get("nom") || "",
    quartier: urlParams.get("quartier") || "",
    ville: urlParams.get("ville") || "",
  };
  let lat = urlParams.get("lat");
  let lon = urlParams.get("lon");

  fillPharmacySearchForm(form);
  const ouvertesEl = document.getElementById("filter-ouvertes");
  const gardeEl = document.getElementById("filter-garde");
  if (ouvertesEl) ouvertesEl.checked = urlParams.get("ouvertes") === "1";
  if (gardeEl) gardeEl.checked = urlParams.get("garde") === "1";

  const { geo, ville: autoVille } = await resolveSearchContext();
  if (!form.nom && !form.ville && autoVille) form.ville = autoVille;

  if (geo && (!lat || !lon)) {
    lat = geo.lat;
    lon = geo.lon;
    urlParams.set("lat", lat);
    urlParams.set("lon", lon);
    if (form.ville) urlParams.set("ville", form.ville);
    history.replaceState(null, "", `?${urlParams.toString()}`);
  }

  const hasGeo = !!(lat && lon);
  const ouvertesOnly = urlParams.get("ouvertes") === "1";
  const gardeOnly = urlParams.get("garde") === "1";
  let summary = pharmacySearchSummary(form, hasGeo);
  if (ouvertesOnly) summary += " — ouvertes";
  if (gardeOnly) summary += " — de garde";
  document.getElementById("search-summary").textContent = summary;

  const resultsEl = document.getElementById("results");
  try {
    const apiParams = apiParamsFromSearch(form, hasGeo ? { lat, lon } : geo, ouvertesOnly);
    let list = await MediCareAPI.getPharmacies(apiParams);
    if (gardeOnly) list = list.filter((p) => p.est_de_garde);
    if (!list.length) {
      resultsEl.innerHTML = '<p class="muted">Aucune pharmacie trouvée.</p>';
      return;
    }
    const geoQuery = hasGeo ? `&lat=${lat}&lon=${lon}` : "";
    mountPharmacyList(resultsEl, list, {
      geoQuery,
      zone: "utilisateur",
      offlineNotice: list._offlineCache,
    });
  } catch (err) {
    resultsEl.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadResults();

  const villeSelect = document.getElementById("search-ville");
  villeSelect?.addEventListener("change", async () => {
    const v = villeSelect.value;
    if (v) setStoredAutoVille(v);
    await loadPharmacyFilterSelects(v);
  });

  document.getElementById("search-pharmacy-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = readPharmacySearchForm();
    const params = new URLSearchParams(location.search);
    params.delete("nom");
    params.delete("quartier");
    params.delete("ville");
    params.delete("ouvertes");
    params.delete("garde");
    if (form.nom) params.set("nom", form.nom);
    if (form.quartier) params.set("quartier", form.quartier);
    const ville = form.ville || getStoredAutoVille();
    if (ville) params.set("ville", ville);
    if (document.getElementById("filter-ouvertes")?.checked) params.set("ouvertes", "1");
    if (document.getElementById("filter-garde")?.checked) params.set("garde", "1");
    window.location.href = `recherchePharmacie.html?${params.toString()}`;
  });
});
