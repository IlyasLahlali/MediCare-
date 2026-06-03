document.addEventListener("DOMContentLoaded", async () => {
  if (!initUtilisateurPage()) return;

  const params = new URLSearchParams(location.search);
  const q = params.get("q") || "";
  const pharmacyId = params.get("pharmacyId");

  const input = document.getElementById("med-q");
  if (input) input.value = q;

  bindMedicamentSearchForm("search-med-form", "utilisateur");

  await loadMedicamentSearchResults({
    resultsEl: document.getElementById("med-results"),
    summaryEl: document.getElementById("med-summary"),
    q,
    pharmacyId: pharmacyId || undefined,
    zone: "utilisateur",
  });
});
