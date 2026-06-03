function trackPharmacyStat(pharmacyId, type) {
  if (!pharmacyId || !type) return;
  fetch(`${typeof API !== "undefined" ? API : "/api"}/stats/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pharmacyId, type }),
  }).catch(() => {});
}
