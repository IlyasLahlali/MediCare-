const { getPharmacySchema } = require("./pharmacySchema");

function statutSelectSql(alias = "p") {
  const s = getPharmacySchema();
  if (!s.hasStatutAdmin) {
    throw new Error("Colonne statut_admin absente — redémarrez le serveur (migration auto).");
  }
  return `${alias}.statut_admin AS statut`;
}

function pharmacyPublishedSql(alias = "p") {
  const s = getPharmacySchema();
  if (!s.hasStatutAdmin) {
    throw new Error("Colonne statut_admin absente — redémarrez le serveur (migration auto).");
  }
  return `${alias}.statut_admin = 'valide'`;
}

module.exports = { statutSelectSql, pharmacyPublishedSql };
