const express = require("express");
const pool = require("../config/db");
const { getPublicPharmacySql } = require("../utils/publicPharmacy");

const router = express.Router();

router.get("/pharmacie/:id", async (req, res) => {
  const pharmacyId = /^\d+$/.test(String(req.params.id)) ? req.params.id : null;
  if (!pharmacyId) return res.status(400).json({ error: "Identifiant invalide" });

  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.quantite, s.date_mise_a_jour,
              m.id AS id_medicament, m.nom, m.description, m.prix
       FROM stock_pharmacie s
       INNER JOIN medicaments m ON m.id = s.id_medicament
       INNER JOIN pharmacies p ON p.id = s.id_pharmacie
       WHERE s.id_pharmacie = ? AND s.quantite > 0 AND ${getPublicPharmacySql()}
       ORDER BY m.nom`,
      [pharmacyId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
