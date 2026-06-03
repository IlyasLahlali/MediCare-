document.addEventListener("DOMContentLoaded", async () => {
  initPharmacyDetailPhotoZoom();

  const id = new URLSearchParams(location.search).get("id");
  const detailEl = document.getElementById("pharmacy-detail");

  if (!id) {
    detailEl.innerHTML = '<p class="error">Pharmacie non spécifiée.</p>';
    return;
  }

  const lat = new URLSearchParams(location.search).get("lat");
  const lon = new URLSearchParams(location.search).get("lon");
  const geoParams = lat && lon ? { lat, lon } : {};
  const geoQuery = lat && lon ? `&lat=${lat}&lon=${lon}` : "";

  const stockCtrl = initPharmacyDetailStock({ zone: "public", pharmacyId: id });
  const stockPromise = stockCtrl.load();

  try {
    const [p] = await Promise.all([MediCareAPI.getPharmacy(id, geoParams), stockPromise]);
    const offlineNotice =
      p._offlineCache && typeof medicareOfflineNoticeHtml === "function"
        ? medicareOfflineNoticeHtml()
        : "";
    MediCareAPI.trackStat(id, "VUE").catch(() => {});

    document.title = `${p.nom} — MediCare+`;
    detailEl.innerHTML =
      offlineNotice +
      renderPharmacyDetailHero(p, { geoQuery, id, backHref: "recherchePharmacie.html" });
    initPharmacyDetailBackLink("recherchePharmacie.html");
    document.getElementById("pharmacy-detail-unified")?.classList.add("is-ready");

  } catch (err) {
    detailEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    const stockEl = document.getElementById("stock-list");
    if (stockEl) stockEl.innerHTML = "";
  }

  detailEl.addEventListener("click", (e) => {
    const call = e.target.closest("[data-track-call]");
    if (call) MediCareAPI.trackStat(call.dataset.trackCall, "APPEL").catch(() => {});
  });
});
