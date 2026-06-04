const express = require("express");
const pool = require("../config/db");
const { authRequired, optionalAuth, requireRole } = require("../middleware/authMiddleware");
const { getPublicPharmacySql } = require("../utils/publicPharmacy");
const { getPharmacySchema } = require("../utils/pharmacySchema");
const { notifyPharmacienNewAvis } = require("../utils/pharmaNotificationService");
const { createNotification } = require("../utils/notificationHelper");
const { queryAvisPharmacieList } = require("../utils/avisPharmacie");

async function getPharmacyName(pharmacyId) {
  const [rows] = await pool.query(`SELECT nom FROM pharmacies WHERE id = ?`, [pharmacyId]);
  return rows[0]?.nom || "cette pharmacie";
}

async function notifyUserAvisAction(userId, pharmacyId, { titre, message }) {
  const payload = {
    userId,
    type: "AVIS",
    titre,
    message,
    lien: `/Utilisateur/html/pharmacieDetail.html?id=${pharmacyId}`,
  };
  try {
    return await createNotification(payload);
  } catch (err) {
    console.error("Notification avis (type AVIS):", err.message);
    return await createNotification({ ...payload, type: "INFO" });
  }
}

const router = express.Router();

async function pharmacyIsPublic(pharmacyId) {
  const [rows] = await pool.query(
    `SELECT id FROM pharmacies p WHERE p.id = ? AND ${getPublicPharmacySql()}`,
    [pharmacyId]
  );
  return rows.length > 0;
}

/** Avis visibles uniquement pour les pharmacies validées (fiche publique + statut admin si présent). */
async function canReadPharmacyAvis(pharmacyId) {
  if (!(await pharmacyIsPublic(pharmacyId))) return false;
  const s = getPharmacySchema();
  if (!s.hasStatutAdmin) return true;
  const [rows] = await pool.query(
    `SELECT id FROM pharmacies WHERE id = ? AND statut_admin = 'valide'`,
    [pharmacyId]
  );
  return rows.length > 0;
}

router.get("/pharmacie/:id", optionalAuth, async (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) {
    return res.status(400).json({ error: "Identifiant invalide" });
  }
  try {
    if (!(await canReadPharmacyAvis(req.params.id))) {
      return res.status(404).json({ error: "Pharmacie introuvable" });
    }

    try {
      res.json(await queryAvisPharmacieList(req.params.id));
    } catch (err) {
      if (err.code === "ER_NO_SUCH_TABLE") {
        return res.json({ note_moyenne: null, nb_avis: 0, avis: [] });
      }
      throw err;
    }
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
    if (!(await canReadPharmacyAvis(req.params.id))) {
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

    const nom = await getPharmacyName(req.params.id);

    try {
      await notifyPharmacienNewAvis(req.params.id, {
        note: n,
        commentaire: commentaire || null,
        isUpdate,
      });
    } catch (notifErr) {
      console.error("Notification avis pharmacien:", notifErr.message);
    }

    const notificationId = await notifyUserAvisAction(req.user.id, req.params.id, {
      titre: isUpdate ? "Avis modifié" : "Avis publié",
      message: `${nom} — votre note ${n}/5 est enregistrée.`,
    }).catch((notifErr) => {
      console.error("Notification avis utilisateur:", notifErr.message);
      return null;
    });

    res.json({
      success: true,
      note: n,
      commentaire: commentaire || null,
      notificationId: notificationId || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.put("/pharmacie/:id/mine", authRequired, requireRole("UTILISATEUR"), async (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) {
    return res.status(400).json({ error: "Identifiant invalide" });
  }

  const { note, commentaire } = req.body;
  const n = parseInt(note, 10);
  if (!n || n < 1 || n > 5) {
    return res.status(400).json({ error: "note entre 1 et 5 requise" });
  }

  try {
    const [result] = await pool.query(
      `UPDATE avis_pharmacie SET note = ?, commentaire = ?
       WHERE id_pharmacie = ? AND id_utilisateur = ?`,
      [n, commentaire || null, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Avis introuvable" });
    }

    const nom = await getPharmacyName(req.params.id);

    try {
      await notifyPharmacienNewAvis(req.params.id, {
        note: n,
        commentaire: commentaire || null,
        isUpdate: true,
      });
    } catch (notifErr) {
      console.error("Notification avis pharmacien:", notifErr.message);
    }

    const notificationId = await notifyUserAvisAction(req.user.id, req.params.id, {
      titre: "Avis modifié",
      message: `${nom} — votre note ${n}/5 a été mise à jour.`,
    }).catch((notifErr) => {
      console.error("Notification avis utilisateur:", notifErr.message);
      return null;
    });

    res.json({ success: true, note: n, commentaire: commentaire || null, notificationId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/pharmacie/:id/mine", authRequired, requireRole("UTILISATEUR"), async (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) {
    return res.status(400).json({ error: "Identifiant invalide" });
  }

  try {
    const [result] = await pool.query(
      `DELETE FROM avis_pharmacie WHERE id_pharmacie = ? AND id_utilisateur = ?`,
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Avis introuvable" });
    }

    await pool
      .query(`DELETE FROM notifications WHERE id_utilisateur = ? AND titre = 'Avis supprimé'`, [
        req.user.id,
      ])
      .catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
