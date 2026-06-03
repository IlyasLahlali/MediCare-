/** Normalisation ville / quartier saisis par le pharmacien (pas depuis l’adresse). */

const INVALID_NAMES = new Set([
  "maroc",
  "morocco",
  "ma",
  "france",
  "espagne",
  "spain",
]);

function normalizeLocationLabel(value) {
  const s = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return "";
  return s
    .split(" ")
    .map((word) => {
      if (word.length <= 2) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function validateVilleQuartier(ville, quartier, { requireQuartier = true } = {}) {
  const errors = [];
  const v = normalizeLocationLabel(ville);
  const q = normalizeLocationLabel(quartier);

  if (!v) errors.push("La ville est obligatoire.");
  else if (INVALID_NAMES.has(v.toLowerCase()) || /^[0-9]{4,6}$/.test(v)) {
    errors.push("Indiquez une ville valide (ex. Marrakech), pas un pays ni un code postal.");
  }

  if (requireQuartier) {
    if (!q) errors.push("Le quartier est obligatoire.");
    else if (INVALID_NAMES.has(q.toLowerCase())) {
      errors.push("Indiquez un quartier valide (ex. Guéliz, Médina).");
    }
  }

  if (v && q && v.toLowerCase() === q.toLowerCase()) {
    errors.push("Le quartier doit être différent de la ville.");
  }

  return { ok: errors.length === 0, errors, ville: v || null, quartier: q || null };
}

module.exports = { normalizeLocationLabel, validateVilleQuartier, INVALID_NAMES };
