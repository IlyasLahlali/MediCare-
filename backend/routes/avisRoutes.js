const express = require("express");
const pool = require("../config/db");
const { authRequired, requireRole } = require("../middleware/authMiddleware");
const { getPublicPharmacySql } = require("../utils/publicPharmacy");
const { notifyPharmacienNewAvis } = require("../utils/pharmaNotificationService");

const router = express.Router();

async function pharmacyIsPublic(pharmacyId) {
  const [rows] = await pool.query(
    `SELECT id FROM pharmacies p WHERE p.id = ? AND ${getPublicPharmacySql()}`,
    [pharmacyId]
  );
  return rows.length > 0;
}

router.get("/pharmacie/:id", async (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) {
    return res.status(400).json({ error: "Identifiant invalide" });
  }
  try {
    if (!(await pharmacyIsPublic(req.params.id))) {
      return res.status(404).json({ error: "Pharmacie introuvable" });
    }

    const [stats] = await pool.query(
      `SELECT ROUND(AVG(note), 1) AS note_moyenne, COUNT(*) AS nb_avis
       FROM avis_pharmacie WHERE id_pharmacie = ?`,
      [req.params.id]
    );

    const [avis] = await pool.query(
      `SELECT a.id, a.note, a.commentaire, a.date_creation, u.nom AS nom_utilisateur
       FROM avis_pharmacie a
       INNER JOIN utilisateurs u ON u.id = a.id_utilisateur
       WHERE a.id_pharmacie = ?
       ORDER BY a.date_creation DESC`,
      [req.params.id]
    );

    res.json({
      note_moyenne: stats[0].note_moyenne,
      nb_avis: stats[0].nb_avis,
      avis,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/pharmacie/:id/mine", authRequired, requireRole("UTILISATEUR"), async (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) {
    return res.status(400).json({ error: "Identifiant invalide" });
  }
  try {
    const [rows] = await pool.query(
      `SELECT id, note, commentaire, date_creation FROM avis_pharmacie
       WHERE id_pharmacie = ? AND id_utilisateur = ?`,
      [req.params.id, req.user.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/pharmacie/:id", authRequired, requireRole("UTILISATEUR"), async (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) {
    return res.status(400).json({ error: "Identifiant invalide" });
  }

  const { note, commentaire } = req.body;
  const n = parseInt(note, 10);
  if (!n || n < 1 || n > 5) {
    return res.status(400).json({ error: "note entre 1 et 5 requise" });
  }

  try {
    if (!(await pharmacyIsPublic(req.params.id))) {
      return res.status(404).json({ error: "Pharmacie introuvable" });
    }

    const [existing] = await pool.query(
      `SELECT id FROM avis_pharmacie WHERE id_utilisateur = ? AND id_pharmacie = ?`,
      [req.user.id, req.params.id]
    );
    const isUpdate = existing.length > 0;

    await pool.query(
      `INSERT INTO avis_pharmacie (id_utilisateur, id_pharmacie, note, commentaire)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE note = VALUES(note), commentaire = VALUES(commentaire)`,
      [req.user.id, req.params.id, n, commentaire || null]
    );

    try {
      await notifyPharmacienNewAvis(req.params.id, {
        note: n,
        commentaire: commentaire || null,
        isUpdate,
      });
    } catch (notifErr) {
      console.error("Notification avis:", notifErr.message);
    }

    res.json({ success: true, note: n, commentaire: commentaire || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
