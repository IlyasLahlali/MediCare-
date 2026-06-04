const pool = require("../config/db");

let schema = null;

async function loadPharmacySchema() {
  if (schema) return schema;

  const [cols] = await pool.query("SHOW COLUMNS FROM pharmacies");
  const fields = new Set(cols.map((c) => c.Field));

  const ownerCol = fields.has("id_pharmacien")
    ? "id_pharmacien"
    : fields.has("id_proprietaire")
      ? "id_proprietaire"
      : "id_pharmacien";

  const hasQuartier = fields.has("quartier");
  const hasVille = fields.has("ville");
  const hasStatutAdmin = fields.has("statut_admin");

  schema = {
    ownerCol,
    hasQuartier,
    hasVille,
    hasStatutAdmin,
    quartierSql: hasQuartier ? "p.quartier" : "NULL",
    villeSql: hasVille ? "p.ville" : "NULL",
    PUBLIC_PHARMACY_SQL: `
      p.statut_admin = 'valide'
      AND EXISTS (
        SELECT 1 FROM utilisateurs u
        WHERE u.id = p.${ownerCol}
          AND u.role = 'PHARMACIEN'
          AND u.statut <> 'REFUSE'
      )
    `,
  };

  if (!hasQuartier || !hasVille) {
    console.warn(
      "Colonnes quartier/ville absentes — exécutez : npm run migrate:quartier-ville (dossier backend)"
    );
  }

  return schema;
}

function getPharmacySchema() {
  if (!schema) {
    throw new Error("Schéma pharmacies non chargé — redémarrez le serveur");
  }
  return schema;
}

function requireLocationColumns(schema) {
  if (!schema.hasVille || !schema.hasQuartier) {
    const err = new Error(
      "Colonnes ville/quartier absentes — exécutez npm run migrate:quartier-ville dans le dossier backend"
    );
    err.code = "MC_LOCATION_COLUMNS";
    throw err;
  }
}

function invalidatePharmacySchemaCache() {
  schema = null;
}

module.exports = {
  loadPharmacySchema,
  getPharmacySchema,
  requireLocationColumns,
  invalidatePharmacySchemaCache,
};
