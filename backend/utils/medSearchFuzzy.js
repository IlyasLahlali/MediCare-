/**
 * Recherche médicament tolérante aux fautes (ex. Doliprane ↔ Dolipranne).
 */

function normalizeMedName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[b.length];
}

/** Score entre 0 et 1 (1 = identique). */
function nameSimilarity(a, b) {
  const na = normalizeMedName(a);
  const nb = normalizeMedName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return Math.max(0.82, ratio);
  }
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

function fuzzyPrefix(query, minLen = 3) {
  const norm = normalizeMedName(query);
  if (norm.length <= minLen) return norm;
  return norm.slice(0, Math.max(minLen, Math.min(5, norm.length - 1)));
}

function minSimilarityForQuery(query) {
  const len = normalizeMedName(query).length;
  if (len <= 3) return 0.78;
  if (len <= 5) return 0.72;
  return 0.65;
}

function rankMedicamentRows(rows, query) {
  const threshold = minSimilarityForQuery(query);
  return rows
    .map((row) => ({
      row,
      score: nameSimilarity(query, row.nom),
    }))
    .filter((x) => x.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.row);
}

module.exports = {
  normalizeMedName,
  nameSimilarity,
  fuzzyPrefix,
  rankMedicamentRows,
  minSimilarityForQuery,
};
