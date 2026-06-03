const { getPharmacySchema } = require("./pharmacySchema");

function statutSelectSql(alias = "p") {
  const s = getPharmacySchema();
  if (s.hasStatutAdmin) return `${alias}.statut_admin AS statut`;
  return `CASE WHEN ${alias}.est_active = 1 THEN 'valide' ELSE 'en_attente' END AS statut`;
}

module.exports = { statutSelectSql };
