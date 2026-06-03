const express = require("express");
const pool = require("../config/db");
const { authRequired, requireRole } = require("../middleware/authMiddleware");
const { getPharmacySchema } = require("../utils/pharmacySchema");
const { getPublicPharmacySql } = require("../utils/publicPharmacy");
const { incrementStat, VALID_TYPES } = require("../utils/trackStat");
const { ownerWhereClause } = require("../utils/pharmacienHelper");

const router = express.Router();

router.post("/track", async (req, res) => {
  const { pharmacyId, type } = req.body;
  if (!pharmacyId || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: "pharmacyId et type (VUE, APPEL, RECHERCHE) requis" });
  }
  if (!/^\d+$/.test(String(pharmacyId))) {
    return res.status(400).json({ error: "Identifiant invalide" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id FROM pharmacies p WHERE p.id = ? AND ${getPublicPharmacySql()}`,
      [pharmacyId]
    );
    if (!rows.length) return res.status(404).json({ error: "Pharmacie introuvable" });

    await incrementStat(pharmacyId, type);
    res.json({ success: true });
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") {
      return res.status(503).json({
        error: "Table statistiques absente — exécutez migration_statistiques.sql",
      });
    }
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/dashboard", authRequired, requireRole("PHARMACIEN"), async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 7));

  try {
    const ownerSql = ownerWhereClause("p");
    const [totals] = await pool.query(
      `SELECT s.type, COALESCE(SUM(s.total), 0) AS total
       FROM statistiques_pharmacie s
       INNER JOIN pharmacies p ON p.id = s.id_pharmacie
       WHERE ${ownerSql}
         AND s.date_jour >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY s.type`,
      [req.user.id, days - 1]
    );

    const byType = { VUE: 0, APPEL: 0, RECHERCHE: 0 };
    for (const row of totals) byType[row.type] = Number(row.total);

    const [daily] = await pool.query(
      `SELECT s.date_jour AS jour,
              SUM(CASE WHEN s.type = 'VUE' THEN s.total ELSE 0 END) AS vues,
              SUM(CASE WHEN s.type = 'APPEL' THEN s.total ELSE 0 END) AS appels,
              SUM(CASE WHEN s.type = 'RECHERCHE' THEN s.total ELSE 0 END) AS recherches,
              SUM(s.total) AS total
       FROM statistiques_pharmacie s
       INNER JOIN pharmacies p ON p.id = s.id_pharmacie
       WHERE ${ownerSql}
         AND s.date_jour >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY s.date_jour
       ORDER BY s.date_jour ASC`,
      [req.user.id, days - 1]
    );

    const [byPharmacy] = await pool.query(
      `SELECT p.id, p.nom,
              SUM(CASE WHEN s.type = 'VUE' THEN s.total ELSE 0 END) AS vues,
              SUM(CASE WHEN s.type = 'APPEL' THEN s.total ELSE 0 END) AS appels,
              SUM(CASE WHEN s.type = 'RECHERCHE' THEN s.total ELSE 0 END) AS recherches
       FROM pharmacies p
       LEFT JOIN statistiques_pharmacie s ON s.id_pharmacie = p.id
         AND s.date_jour >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       WHERE ${ownerSql}
       GROUP BY p.id, p.nom
       ORDER BY (
         SUM(CASE WHEN s.type = 'VUE' THEN s.total ELSE 0 END) +
         SUM(CASE WHEN s.type = 'APPEL' THEN s.total ELSE 0 END) +
         SUM(CASE WHEN s.type = 'RECHERCHE' THEN s.total ELSE 0 END)
       ) DESC`,
      [days - 1, req.user.id]
    );

    const s = getPharmacySchema();
    const [pharmacyCount] = await pool.query(
      `SELECT COUNT(*) AS n FROM pharmacies p WHERE p.${s.ownerCol} = ?`,
      [req.user.id]
    );

    res.json({
      periode_jours: days,
      totaux: byType,
      trafic_total: byType.VUE + byType.APPEL + byType.RECHERCHE,
      nb_pharmacies: Number(pharmacyCount[0].n),
      trafic_quotidien: daily.map((d) => ({
        jour: d.jour,
        vues: Number(d.vues),
        appels: Number(d.appels),
        recherches: Number(d.recherches),
        total: Number(d.total),
      })),
      par_pharmacie: byPharmacy.map((p) => ({
        id: p.id,
        nom: p.nom,
        vues: Number(p.vues),
        appels: Number(p.appels),
        recherches: Number(p.recherches),
      })),
    });
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") {
      const s = getPharmacySchema();
      let nb = 0;
      try {
        const [c] = await pool.query(
          `SELECT COUNT(*) AS n FROM pharmacies p WHERE p.${s.ownerCol} = ?`,
          [req.user.id]
        );
        nb = Number(c[0].n);
      } catch {
        /* ignore */
      }
      return res.json({
        periode_jours: days,
        totaux: { VUE: 0, APPEL: 0, RECHERCHE: 0 },
        trafic_total: 0,
        nb_pharmacies: nb,
        trafic_quotidien: [],
        par_pharmacie: [],
        warning: "Table statistiques absente — exécutez migration_statistiques.sql",
      });
    }
    console.error("stats/dashboard:", err);
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});

module.exports = router;
