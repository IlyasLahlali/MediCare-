document.addEventListener("DOMContentLoaded", async () => {
  if (!initUtilisateurPage()) return;

  const listEl = document.getElementById("favoris-list");
  try {
    const list = await MediCareAPI.getFavoris();
    if (!list.length) {
      listEl.innerHTML =
        '<p class="muted">Aucun favori. Ajoutez des pharmacies depuis leur fiche détail.</p>';
      return;
    }
    const geo = await ensureUserGeo();
    const geoQuery = geo ? `&lat=${geo.lat}&lon=${geo.lon}` : "";
    mountPharmacyList(listEl, list, {
      geoQuery,
      zone: "utilisateur",
      offlineNotice: list._offlineCache,
    });
  } catch (err) {
    listEl.innerHTML = `<p class="error">${err.message}</p>`;
  }
});
