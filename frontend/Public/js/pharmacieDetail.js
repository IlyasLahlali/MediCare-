document.addEventListener("DOMContentLoaded", async () => {
  const id = new URLSearchParams(location.search).get("id");
  const detailEl = document.getElementById("pharmacy-detail");
  const stockEl = document.getElementById("stock-list");
  const stockCountEl = document.getElementById("stock-count");
  const stockSummaryEl = document.getElementById("stock-summary");

  if (!id) {
    detailEl.innerHTML = '<p class="error">Pharmacie non spécifiée.</p>';
    return;
  }

  const lat = new URLSearchParams(location.search).get("lat");
  const lon = new URLSearchParams(location.search).get("lon");
  const geoParams = lat && lon ? { lat, lon } : {};
  const geoQuery = lat && lon ? `&lat=${lat}&lon=${lon}` : "";

  try {
    const p = await MediCareAPI.getPharmacy(id, geoParams);
    const offlineNotice =
      p._offlineCache && typeof medicareOfflineNoticeHtml === "function"
        ? medicareOfflineNoticeHtml()
        : "";
    MediCareAPI.trackStat(id, "VUE").catch(() => {});

    document.title = `${p.nom} — MediCare+`;
    detailEl.innerHTML =
      offlineNotice +
      renderPharmacyDetailHero(p, { geoQuery, id, backHref: "recherchePharmacie.html" });

    const stock = await MediCareAPI.getStock(id);
    const stockNotice =
      stock._offlineCache && typeof medicareOfflineNoticeHtml === "function"
        ? medicareOfflineNoticeHtml()
        : "";

    stockEl.innerHTML = stockNotice + renderPharmacyStockGrid(stock);

    if (stock.length) {
      stockCountEl.hidden = false;
      stockCountEl.textContent = `${stock.length} médicament${stock.length > 1 ? "s" : ""}`;
      stockSummaryEl.textContent = "Disponibilités actuelles dans cette officine.";
    } else {
      stockCountEl.hidden = true;
      stockSummaryEl.textContent = "Aucune disponibilité publiée pour le moment.";
    }
  } catch (err) {
    detailEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    stockEl.innerHTML = "";
  }

  detailEl.addEventListener("click", (e) => {
    const call = e.target.closest("[data-track-call]");
    if (call) MediCareAPI.trackStat(call.dataset.trackCall, "APPEL").catch(() => {});
  });

  document.getElementById("search-med-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("med-q").value.trim();
    if (q.length < 2) return;
    const onlyHere = document.getElementById("med-this-pharmacy")?.checked;
    window.location.href = medicamentSearchResultsUrl("public", q, onlyHere ? id : undefined);
  });
});
