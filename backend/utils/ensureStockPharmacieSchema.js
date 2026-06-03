const pool = require("../config/db");

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

/** Filtre SQL : ligne de stock visible pour les clients */
function stockDisponibleSql(alias = "s") {
  return `${alias}.disponible = 1`;
}

async function ensureStockPharmacieSchema() {
  if (!(await columnExists("stock_pharmacie", "disponible"))) {
    await pool.query(
      `ALTER TABLE stock_pharmacie ADD COLUMN disponible TINYINT(1) NOT NULL DEFAULT 1`
    );
    console.log("Migration : colonne stock_pharmacie.disponible ajoutée.");
  }

  if (await columnExists("stock_pharmacie", "quantite")) {
    await pool.query(`UPDATE stock_pharmacie SET disponible = IF(quantite > 0, 1, 0)`);
  }

  if (!(await columnExists("stock_pharmacie", "prix"))) {
    await pool.query(`ALTER TABLE stock_pharmacie ADD COLUMN prix DECIMAL(10, 2) NULL`);
    console.log("Migration : colonne stock_pharmacie.prix ajoutée.");
    try {
      await pool.query(
        `UPDATE stock_pharmacie s
         INNER JOIN medicaments m ON m.id = s.id_medicament
         SET s.prix = m.prix
         WHERE s.prix IS NULL AND m.prix IS NOT NULL`
      );
    } catch (err) {
      console.warn("Migration prix stock (copie medicaments) :", err.message);
    }
  }

  if (await columnExists("stock_pharmacie", "quantite")) {
    await pool.query(`ALTER TABLE stock_pharmacie DROP COLUMN quantite`);
    console.log("Migration : colonne stock_pharmacie.quantite supprimée.");
  }
}

let stockSchemaReady = null;

function invalidateStockSchemaCache() {
  stockSchemaReady = null;
}

function ensureStockPharmacieSchemaOnce() {
  if (!stockSchemaReady) {
    stockSchemaReady = ensureStockPharmacieSchema().catch((err) => {
      stockSchemaReady = null;
      throw err;
    });
  }
  return stockSchemaReady;
}

const STOCK_LIST_SQL = `SELECT s.id, s.prix, s.disponible, s.date_mise_a_jour,
              m.id AS id_medicament, m.nom, m.description
       FROM stock_pharmacie s
       INNER JOIN medicaments m ON m.id = s.id_medicament
       WHERE s.id_pharmacie = ?
       ORDER BY m.nom`;

const STOCK_LIST_LEGACY_SQL = `SELECT s.id, s.quantite, s.date_mise_a_jour,
              m.id AS id_medicament, m.nom, m.description, m.prix
       FROM stock_pharmacie s
       INNER JOIN medicaments m ON m.id = s.id_medicament
       WHERE s.id_pharmacie = ?
       ORDER BY m.nom`;

function mapLegacyStockRows(rows) {
  return rows.map((r) => ({
    id: r.id,
    prix: r.prix != null ? r.prix : null,
    disponible: Number(r.quantite) > 0 ? 1 : 0,
    date_mise_a_jour: r.date_mise_a_jour,
    id_medicament: r.id_medicament,
    nom: r.nom,
    description: r.description,
  }));
}

async function queryPharmacienStockList(pharmacyId) {
  await ensureStockPharmacieSchemaOnce();
  try {
    const [rows] = await pool.query(STOCK_LIST_SQL, [pharmacyId]);
    return rows;
  } catch (err) {
    if (err.code !== "ER_BAD_FIELD_ERROR") throw err;
    invalidateStockSchemaCache();
    await ensureStockPharmacieSchema();
    try {
      const [rows] = await pool.query(STOCK_LIST_SQL, [pharmacyId]);
      return rows;
    } catch (err2) {
      if (err2.code !== "ER_BAD_FIELD_ERROR") throw err2;
      const [legacy] = await pool.query(STOCK_LIST_LEGACY_SQL, [pharmacyId]);
      return mapLegacyStockRows(legacy);
    }
  }
}

module.exports = {
  ensureStockPharmacieSchema,
  ensureStockPharmacieSchemaOnce,
  invalidateStockSchemaCache,
  stockDisponibleSql,
  queryPharmacienStockList,
};
