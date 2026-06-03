async function loadResults() {
  const params = new URLSearchParams(location.search);
  const q = params.get("q") || "";
  const pharmacyId = params.get("pharmacyId");

  const input = document.getElementById("med-q");
  if (input) input.value = q;

  await loadMedicamentSearchResults({
    resultsEl: document.getElementById("results"),
    summaryEl: document.getElementById("search-summary"),
    q,
    pharmacyId: pharmacyId || undefined,
    zone: "public",
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadResults();
  bindMedicamentSearchForm("search-med-form", "public");
});
