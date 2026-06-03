const express = require("express");
const pool = require("../config/db");
const { getPublicPharmacySql } = require("../utils/publicPharmacy");
const { incrementStat } = require("../utils/trackStat");
const { fuzzyPrefix, rankMedicamentRows } = require("../utils/medSearchFuzzy");
const { stockDisponibleSql } = require("../utils/ensureStockPharmacieSchema");

const router = express.Router();

const SELECT_STOCK = `SELECT m.id, m.nom, m.description,
             COALESCE(s.prix, m.prix) AS prix,
             p.id AS id_pharmacie, p.nom AS nom_pharmacie, p.adresse`;

/** Appelé uniquement pendant une requête HTTP (schéma déjà chargé par server.js). */
function fromStockSql() {
  return `
      FROM medicaments m
      INNER JOIN stock_pharmacie s ON s.id_medicament = m.id AND ${stockDisponibleSql("s")}
      INNER JOIN pharmacies p ON p.id = s.id_pharmacie
      WHERE ${getPublicPharmacySql()}`;
}

async function queryMedicamentStock(extraWhere, params, pharmacyId, limit = null) {
  let sql = `${SELECT_STOCK} ${fromStockSql()} ${extraWhere}`;
  const values = [...params];

  if (pharmacyId && /^\d+$/.test(String(pharmacyId))) {
    sql += ` AND p.id = ?`;
    values.push(pharmacyId);
  }

  sql += ` ORDER BY m.nom, p.nom`;
  if (limit) sql += ` LIMIT ${Number(limit)}`;

  const [rows] = await pool.query(sql, values);
  return rows;
}

async function searchMedicamentsInDb(q, pharmacyId) {
  const exact = await queryMedicamentStock(`AND m.nom LIKE ?`, [`%${q}%`], pharmacyId);
  if (exact.length) return exact;

  const prefix = fuzzyPrefix(q);
  if (prefix.length < 2) return [];

  const candidates = await queryMedicamentStock(
    `AND LOWER(m.nom) LIKE ?`,
    [`%${prefix}%`],
    pharmacyId,
    200
  );

  return rankMedicamentRows(candidates, q);
}

router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const pharmacyId = req.query.pharmacyId;

  if (q.length < 2) {
    return res.status(400).json({ error: "Saisissez au moins 2 caractères" });
  }

  try {
    const rows = await searchMedicamentsInDb(q, pharmacyId);

    const pharmacyIds = [...new Set(rows.map((r) => r.id_pharmacie))];
    for (const pid of pharmacyIds) {
      incrementStat(pid, "RECHERCHE").catch(() => {});
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
