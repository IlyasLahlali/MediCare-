const express = require("express");
const pool = require("../config/db");
const { authRequired, requireRole } = require("../middleware/authMiddleware");
const { getPharmacySchema } = require("../utils/pharmacySchema");
const { createNotification } = require("../utils/notificationHelper");
const {
  notifyAdminPharmacyValidated,
  notifyAdminPharmacyRefused,
} = require("../utils/adminNotificationService");
const { attachPharmacyHoraires } = require("../utils/pharmacyHorairesDb");
const { applyEffectiveOpenToRow } = require("../utils/pharmacyHours");
const { gardeEffectiveSelectSql, gardePlanningSelectSql } = require("../utils/gardePublicSql");

const router = express.Router();
router.use(authRequired, requireRole("ADMIN"));

const FILTRES = ["en_attente", "valide", "refuse"];

function statutExpr(alias = "p") {
  return `${alias}.statut_admin`;
}

function ownerJoinSql() {
  const s = getPharmacySchema();
  return `INNER JOIN utilisateurs u ON u.id = p.${s.ownerCol}`;
}

router.get("/stats", async (req, res) => {
  try {
    const st = statutExpr("p");
    const [rows] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM utilisateurs WHERE role = 'UTILISATEUR') AS totalUtilisateurs,
        (SELECT COUNT(*) FROM utilisateurs WHERE role = 'PHARMACIEN') AS totalPharmaciens,
        (SELECT COUNT(*) FROM pharmacies) AS totalPharmacies,
        (SELECT COUNT(*) FROM pharmacies p WHERE ${st} = 'valide') AS pharmaciesValides,
        (SELECT COUNT(*) FROM pharmacies p WHERE ${st} = 'en_attente') AS pharmaciesEnAttente,
        (SELECT COUNT(*) FROM pharmacies p WHERE ${st} = 'refuse') AS pharmaciesRefusees
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/pharmacies/search", async (req, res) => {
  const pharmacien = String(req.query.pharmacien || "").trim();
  const pharmacie = String(req.query.pharmacie || "").trim();
  const ville = String(req.query.ville || "").trim();

  if (!pharmacien && !pharmacie && !ville) {
    return res.status(400).json({ error: "Indiquez au moins un critère de recherche" });
  }

  const s = getPharmacySchema();
  const st = statutExpr("p");

  let sql = `
    SELECT p.id, p.nom, p.adresse, ${s.quartierSql} AS quartier, ${s.villeSql} AS ville,
           p.telephone, p.image, ${st} AS statut,
           u.nom AS pharmacien_nom, u.email AS pharmacien_email,
           (SELECT COUNT(*) FROM stock_pharmacie sp WHERE sp.id_pharmacie = p.id) AS nb_stock
    FROM pharmacies p
    ${ownerJoinSql()}
    WHERE 1=1`;
  const params = [];

  if (pharmacien) {
    sql += " AND u.nom LIKE ?";
    params.push(`%${pharmacien}%`);
  }
  if (pharmacie) {
    sql += " AND p.nom LIKE ?";
    params.push(`%${pharmacie}%`);
  }
  if (ville) {
    if (s.hasVille) {
      sql += " AND p.ville LIKE ?";
      params.push(`%${ville}%`);
    } else {
      sql += ` AND (${s.villeSql} LIKE ? OR p.adresse LIKE ?)`;
      params.push(`%${ville}%`, `%${ville}%`);
    }
  }

  sql += " ORDER BY p.nom ASC";

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/pharmacies/list", async (req, res) => {
  const statut = String(req.query.statut || "").trim();
  const s = getPharmacySchema();
  const st = statutExpr("p");

  let sql = `
    SELECT p.id, p.nom, p.adresse, ${s.quartierSql} AS quartier, ${s.villeSql} AS ville,
           p.telephone, p.image, ${st} AS statut,
           u.nom AS pharmacien_nom, u.email AS pharmacien_email,
           (SELECT COUNT(*) FROM stock_pharmacie sp WHERE sp.id_pharmacie = p.id) AS nb_stock
    FROM pharmacies p
    ${ownerJoinSql()}
  `;
  const params = [];

  if (statut && FILTRES.includes(statut)) {
    sql += ` WHERE ${st} = ?`;
    params.push(statut);
  }

  sql += " ORDER BY p.id DESC";

  const limit = parseInt(req.query.limit, 10);
  if (Number.isFinite(limit) && limit > 0 && limit <= 50) {
    sql += ` LIMIT ${limit}`;
  }

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/pharmacies/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });

  const s = getPharmacySchema();
  const st = statutExpr("p");

  try {
    const [rows] = await pool.query(
      `SELECT p.*, ${s.quartierSql} AS quartier, ${s.villeSql} AS ville,
              ${st} AS statut,
              ${gardeEffectiveSelectSql()},
              ${gardePlanningSelectSql()},
              u.id AS pharmacien_id, u.nom AS pharmacien_nom, u.email AS pharmacien_email,
              u.statut AS pharmacien_statut, u.date_creation AS pharmacien_date_creation
       FROM pharmacies p
       ${ownerJoinSql()}
       WHERE p.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Pharmacie introuvable" });

    const pharmacy = rows[0];
    pharmacy.est_de_garde = !!(pharmacy.garde_date_debut && pharmacy.garde_date_fin);
    await attachPharmacyHoraires(pharmacy);
    applyEffectiveOpenToRow(pharmacy);
    let stock = [];
    try {
      const [stockRows] = await pool.query(
        `SELECT s.id, s.prix, s.disponible, m.nom, m.description
         FROM stock_pharmacie s
         INNER JOIN medicaments m ON m.id = s.id_medicament
         WHERE s.id_pharmacie = ?
         ORDER BY m.nom`,
        [id]
      );
      stock = stockRows;
    } catch (stockErr) {
      if (stockErr.code !== "ER_NO_SUCH_TABLE") throw stockErr;
    }

    res.json({ ...pharmacy, stock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

async function setPharmacyStatut(pharmacyId, statut) {
  await pool.query(`UPDATE pharmacies SET statut_admin = ? WHERE id = ?`, [statut, pharmacyId]);
}

async function notifyOwner(pharmacyId, { titre, message, lien }) {
  const s = getPharmacySchema();
  const [rows] = await pool.query(
    `SELECT p.nom, p.${s.ownerCol} AS owner_id FROM pharmacies p WHERE p.id = ?`,
    [pharmacyId]
  );
  if (!rows[0]?.owner_id) return;
  await createNotification({
    userId: rows[0].owner_id,
    type: "SYSTEM",
    titre,
    message,
    lien: lien || `/Pharmacien/html/pharmacieDetail.html?id=${pharmacyId}`,
  });
}

router.put("/pharmacies/:id/valider", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });

  try {
    const s = getPharmacySchema();
    const [rows] = await pool.query(
      `SELECT p.id, p.nom, p.${s.ownerCol} AS owner_id FROM pharmacies p WHERE p.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Pharmacie introuvable" });

    await setPharmacyStatut(id, "valide");

    if (rows[0].owner_id) {
      await notifyOwner(id, {
        titre: "Pharmacie validée",
        message: `« ${rows[0].nom} » est publiée sur MediCare+ et visible par le public.`,
      });
    }

    try {
      await notifyAdminPharmacyValidated(req.user.id, id, rows[0].nom);
    } catch (notifErr) {
      console.warn("Notification admin validation:", notifErr.message);
    }

    res.json({ success: true, message: "Pharmacie validée avec succès" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.put("/pharmacies/:id/refuser", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });

  try {
    const s = getPharmacySchema();
    const [rows] = await pool.query(`SELECT id, nom FROM pharmacies WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: "Pharmacie introuvable" });

    await setPharmacyStatut(id, "refuse");
    await notifyOwner(id, {
      titre: "Pharmacie refusée",
      message: `« ${rows[0].nom} » n'a pas été publiée. Contactez l'administration pour plus d'informations.`,
    });

    try {
      await notifyAdminPharmacyRefused(req.user.id, id, rows[0].nom);
    } catch (notifErr) {
      console.warn("Notification admin refus:", notifErr.message);
    }

    res.json({ success: true, message: "Pharmacie refusée" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
