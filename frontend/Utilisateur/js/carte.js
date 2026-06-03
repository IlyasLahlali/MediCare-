document.addEventListener("DOMContentLoaded", () => {
  if (!initUtilisateurPage()) return;
  PharmacyMap.init({ zone: "utilisateur", enableFavoris: true });
});
