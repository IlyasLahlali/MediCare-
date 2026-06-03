const express = require("express");
const pool = require("../config/db");
const { authRequired, requireRole } = require("../middleware/authMiddleware");
const { getPublicPharmacySql } = require("../utils/publicPharmacy");
const { gardePlanningSelectSql, gardeEffectiveSelectSql } = require("../utils/gardePublicSql");
const { pharmacyEffectiveOpenSelectSql } = require("../utils/pharmacyHours");
const { getPharmacySchema } = require("../utils/pharmacySchema");
const { createNotification } = require("../utils/notificationHelper");

const router = express.Router();

router.use(authRequired, requireRole("UTILISATEUR"));

router.get("/", async (req, res) => {
  const s = getPharmacySchema();
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.nom, p.adresse, ${s.quartierSql} AS quartier, ${s.villeSql} AS ville,
              p.telephone, p.latitude, p.longitude,
              p.heure_ouverture, p.heure_fermeture,
              p.image,
              ${pharmacyEffectiveOpenSelectSql()},
              ${gardeEffectiveSelectSql()},
              ${gardePlanningSelectSql()},
              f.date_creation AS date_favori
       FROM favoris_pharmacie f
       INNER JOIN pharmacies p ON p.id = f.id_pharmacie
       WHERE f.id_utilisateur = ? AND ${getPublicPharmacySql()}
       ORDER BY f.date_creation DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/check/:pharmacyId", async (req, res) => {
  if (!/^\d+$/.test(String(req.params.pharmacyId))) {
    return res.status(400).json({ error: "Identifiant invalide" });
  }
  try {
    const [rows] = await pool.query(
      `SELECT id FROM favoris_pharmacie WHERE id_utilisateur = ? AND id_pharmacie = ?`,
      [req.user.id, req.params.pharmacyId]
    );
    res.json({ est_favori: rows.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/:pharmacyId", async (req, res) => {
  if (!/^\d+$/.test(String(req.params.pharmacyId))) {
    return res.status(400).json({ error: "Identifiant invalide" });
  }
  try {
    const [ph] = await pool.query(
      `SELECT id FROM pharmacies p WHERE p.id = ? AND ${getPublicPharmacySql()}`,
      [req.params.pharmacyId]
    );
    if (!ph.length) return res.status(404).json({ error: "Pharmacie introuvable" });

    const [existing] = await pool.query(
      `SELECT id FROM favoris_pharmacie WHERE id_utilisateur = ? AND id_pharmacie = ?`,
      [req.user.id, req.params.pharmacyId]
    );

    if (existing.length) {
      await pool.query(`DELETE FROM favoris_pharmacie WHERE id = ?`, [existing[0].id]);
      return res.json({ est_favori: false });
    }

    await pool.query(
      `INSERT INTO favoris_pharmacie (id_utilisateur, id_pharmacie) VALUES (?, ?)`,
      [req.user.id, req.params.pharmacyId]
    );

    const [info] = await pool.query(`SELECT nom FROM pharmacies WHERE id = ?`, [
      req.params.pharmacyId,
    ]);
    await createNotification({
      userId: req.user.id,
      type: "FAVORI",
      titre: "Ajouté aux favoris",
      message: `${info[0]?.nom || "Pharmacie"} est dans vos favoris.`,
      lien: `/Utilisateur/html/pharmacieDetail.html?id=${req.params.pharmacyId}`,
    });

    res.json({ est_favori: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
