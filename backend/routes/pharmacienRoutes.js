const express = require("express");
const pool = require("../config/db");
const { authRequired, requireRole } = require("../middleware/authMiddleware");
const { getPharmacySchema, requireLocationColumns } = require("../utils/pharmacySchema");
const { validateVilleQuartier } = require("../utils/locationLabels");
const { statutSelectSql } = require("../utils/pharmacyStatut");
const { getOwnedPharmacy, ownerWhereClause } = require("../utils/pharmacienHelper");
const { savePharmacyImageFromDataUrl } = require("../utils/savePharmacyImage");
const { parseBodyFields, reverseGeocode, forwardGeocode } = require("../utils/geocode");
const {
  parseWeekSchedule,
  validateWeek,
  weekFromLegacy,
  defaultWeek,
} = require("../utils/weeklyPharmacyHours");
const {
  attachPharmacyHoraires,
  attachPharmacyHorairesList,
  saveNormalHours,
} = require("../utils/pharmacyHorairesDb");
const { setManualClose, attachManualCloseFlag } = require("../utils/pharmacyManualClose");
const { applyEffectiveOpenToRow } = require("../utils/pharmacyHours");
const {
  activateGarde,
  deactivateGarde,
  getActivePlanning,
  getGardeSummaryForUser,
  isPlanningInProgress,
  syncGardeFlagsFromPlanning,
} = require("../utils/gardeService");
const { gardeEffectiveSelectSql } = require("../utils/gardePublicSql");
const { pharmacyEffectiveOpenSelectSql } = require("../utils/pharmacyHours");
const {
  ensureStockPharmacieSchemaOnce,
  queryPharmacienStockList,
} = require("../utils/ensureStockPharmacieSchema");
const { queryAvisPharmacieList } = require("../utils/avisPharmacie");
const {
  notifyPharmacienPharmacyCreated,
  notifyPharmacienPharmacyUpdated,
  notifyPharmacienPharmacyDeleted,
} = require("../utils/pharmaNotificationService");
const { notifyAdminsPharmacyPending } = require("../utils/adminNotificationService");

const { ensurePharmacyHorairesTablesSchemaOnce } = require("../utils/pharmacyHorairesDb");

const router = express.Router();

router.use(authRequired, requireRole("PHARMACIEN"));
router.use(async (req, res, next) => {
  try {
    await ensurePharmacyHorairesTablesSchemaOnce();
    next();
  } catch (err) {
    next(err);
  }
});

function parseId(param) {
  return /^\d+$/.test(String(param)) ? param : null;
}

router.get("/pharmacies", async (req, res) => {
  const s = getPharmacySchema();
  const q = String(req.query.q || "").trim();

  try {
    let sql = `
      SELECT p.id, p.nom, p.adresse, ${s.quartierSql} AS quartier, ${s.villeSql} AS ville,
             p.telephone, p.latitude, p.longitude,
             ${pharmacyEffectiveOpenSelectSql()}, ${gardeEffectiveSelectSql()}, p.image, p.date_creation,
             ${statutSelectSql("p")}
      FROM pharmacies p
      WHERE p.${s.ownerCol} = ?`;
    const params = [req.user.id];

    if (q) {
      sql += ` AND (p.nom LIKE ? OR p.adresse LIKE ? OR ${s.quartierSql} LIKE ? OR ${s.villeSql} LIKE ?)`;
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }

    sql += ` ORDER BY p.nom`;

    const [rows] = await pool.query(sql, params);
    await attachPharmacyHorairesList(rows);
    for (const row of rows) {
      applyEffectiveOpenToRow(row);
      await attachManualCloseFlag(row);
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/garde", async (req, res) => {
  const s = getPharmacySchema();
  try {
    const list = await getGardeSummaryForUser(req.user.id, s.ownerCol);
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/pharmacies/:id/garde/activate", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });
  try {
    const result = await activateGarde(id, req.user.id, {
      date_debut: req.body.date_debut,
      date_fin: req.body.date_fin,
    });
    if (!result) return res.status(404).json({ error: "Pharmacie introuvable" });
    await syncGardeFlagsFromPlanning(id);
    res.json({
      success: true,
      message: result.updated
        ? "Période de garde enregistrée."
        : "Mode de garde activé — votre pharmacie apparaît comme « de garde » sur MediCare+",
      planning_garde: {
        date_debut: result.date_debut,
        date_fin: result.date_fin,
      },
      ...result,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || "Erreur serveur" });
  }
});

router.post("/pharmacies/:id/garde/deactivate", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });
  try {
    const result = await deactivateGarde(id, req.user.id);
    if (!result) return res.status(404).json({ error: "Pharmacie introuvable" });
    res.json({
      success: true,
      message: "Mode de garde désactivé",
      ...result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

async function handleManualCloseRoute(req, res, ferme) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });

  try {
    if (!(await getOwnedPharmacy(id, req.user.id))) {
      return res.status(404).json({
        error: "Pharmacie introuvable ou vous n'êtes pas le propriétaire de cette fiche.",
      });
    }
    const result = await setManualClose(id, ferme);
    if (!result.ok) return res.status(503).json({ error: result.error });

    const pharmacy = await getOwnedPharmacy(id, req.user.id);
    await attachPharmacyHoraires(pharmacy);
    const planning = await getActivePlanning(id);
    pharmacy.est_de_garde = isPlanningInProgress(planning);
    await attachManualCloseFlag(pharmacy);

    res.json({
      success: true,
      fermeture_manuelle: pharmacy.fermeture_manuelle,
      est_ouverte: pharmacy.est_ouverte,
      message: ferme
        ? "Pharmacie affichée comme fermée pour les clients (jusqu'à réouverture manuelle)."
        : "Retour au statut selon vos horaires habituels.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

router.put("/pharmacies/:id/fermeture-manuelle", async (req, res) => {
  const ferme = req.body?.ferme === true || req.body?.ferme === 1 || req.body?.ferme === "1";
  return handleManualCloseRoute(req, res, ferme);
});

router.post("/pharmacies/:id/marquer-ferme", async (req, res) => {
  return handleManualCloseRoute(req, res, true);
});

router.post("/pharmacies/:id/marquer-ouverte", async (req, res) => {
  return handleManualCloseRoute(req, res, false);
});

router.get("/geocode-reverse", async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "lat et lon requis" });
  }
  try {
    const geo = await reverseGeocode(lat, lon);
    if (!geo || (!String(geo.adresse || "").trim() && !geo.ville && !geo.quartier)) {
      return res.status(502).json({
        error:
          "Impossible de lire l'adresse à cet emplacement. Saisissez-la manuellement (la position GPS reste enregistrée).",
      });
    }
    res.json({
      adresse: geo.adresse || "",
      quartier: geo.quartier || "",
      ville: geo.ville || "",
      partial: !String(geo.adresse || "").trim(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/geocode-forward", async (req, res) => {
  try {
    const geo = await forwardGeocode({
      q: req.query.q,
      adresse: req.query.adresse,
      quartier: req.query.quartier,
      ville: req.query.ville,
    });
    if (!geo) {
      return res.status(404).json({ error: "Adresse introuvable — précisez l’adresse ou la ville." });
    }
    res.json(geo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/pharmacies/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });

  try {
    const pharmacy = await getOwnedPharmacy(id, req.user.id);
    if (!pharmacy) return res.status(404).json({ error: "Pharmacie introuvable" });

    let totals = { VUE: 0, APPEL: 0, RECHERCHE: 0 };
    try {
      const [stats] = await pool.query(
        `SELECT type, COALESCE(SUM(total), 0) AS total
         FROM statistiques_pharmacie
         WHERE id_pharmacie = ? AND date_jour >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
         GROUP BY type`,
        [id]
      );
      for (const row of stats) totals[row.type] = Number(row.total);
    } catch (statsErr) {
      if (statsErr.code !== "ER_NO_SUCH_TABLE") throw statsErr;
    }

    let note_moyenne = null;
    let nb_avis = 0;
    try {
      const [avis] = await pool.query(
        `SELECT ROUND(AVG(note), 1) AS note_moyenne, COUNT(*) AS nb_avis
         FROM avis_pharmacie WHERE id_pharmacie = ?`,
        [id]
      );
      note_moyenne = avis[0]?.note_moyenne;
      nb_avis = Number(avis[0]?.nb_avis) || 0;
    } catch (avisErr) {
      if (avisErr.code !== "ER_NO_SUCH_TABLE") throw avisErr;
    }

    const planning = await getActivePlanning(id);
    const inProgress = isPlanningInProgress(planning);

    await attachPharmacyHoraires(pharmacy);
    pharmacy.est_de_garde = inProgress;
    await attachManualCloseFlag(pharmacy);
    res.json({
      ...pharmacy,
      est_de_garde: inProgress,
      stats_30j: totals,
      note_moyenne,
      nb_avis,
      planning_garde: planning,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/pharmacies", async (req, res) => {
  const s = getPharmacySchema();
  const data = parseBodyFields(req.body);
  const { imageDataUrl } = req.body;

  try {
    requireLocationColumns(s);
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  if (!data.nom) return res.status(400).json({ error: "Le nom est requis" });
  if (data.latitude == null || data.longitude == null) {
    return res.status(400).json({
      error: "Position GPS requise — placez le repère sur la carte ou utilisez « Ma position »",
    });
  }

  let adresse = data.adresse;
  let quartier = data.quartier;
  let ville = data.ville;

  if (!adresse) {
    const geo = await reverseGeocode(data.latitude, data.longitude);
    if (geo) {
      adresse = geo.adresse || adresse;
      if (!quartier) quartier = geo.quartier || null;
      if (!ville) ville = geo.ville || null;
    }
  }

  if (!adresse) {
    return res.status(400).json({ error: "Adresse requise (saisie ou via la carte)" });
  }

  const loc = validateVilleQuartier(ville, quartier);
  if (!loc.ok) {
    return res.status(400).json({ error: loc.errors.join(" ") });
  }
  ville = loc.ville;
  quartier = loc.quartier;

  try {
    let imagePath = null;
    if (imageDataUrl) {
      imagePath = savePharmacyImageFromDataUrl(imageDataUrl);
    }

    const cols = ["nom", "adresse", "telephone", s.ownerCol, "statut_admin"];
    const vals = [data.nom, adresse, data.telephone, req.user.id, "en_attente"];

    cols.push("quartier", "ville");
    vals.push(quartier, ville);

    let weekToSave = defaultWeek();
    if (req.body.horaires_semaine !== undefined) {
      weekToSave = parseWeekSchedule(req.body.horaires_semaine);
      const check = validateWeek(weekToSave);
      if (!check.ok) return res.status(400).json({ error: check.error });
    } else if (data.heure_ouverture || data.heure_fermeture) {
      weekToSave = weekFromLegacy(data.heure_ouverture, data.heure_fermeture) || defaultWeek();
    }

    cols.push("latitude", "longitude", "est_de_garde", "image");
    vals.push(data.latitude, data.longitude, data.est_de_garde, imagePath);

    const [result] = await pool.query(
      `INSERT INTO pharmacies (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      vals
    );

    const saved = await saveNormalHours(result.insertId, weekToSave);
    if (!saved.ok) return res.status(400).json({ error: saved.error });

    try {
      await notifyPharmacienPharmacyCreated(req.user.id, result.insertId, data.nom);
      const pharmacienNom = req.user.nom || null;
      await notifyAdminsPharmacyPending(result.insertId, data.nom, pharmacienNom);
    } catch (notifErr) {
      console.warn("Notification création pharmacie:", notifErr.message);
    }

    res.status(201).json({
      id: result.insertId,
      image: imagePath,
      message: "Pharmacie créée. Elle sera visible après validation admin.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});

router.put("/pharmacies/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });

  const pharmacy = await getOwnedPharmacy(id, req.user.id);
  if (!pharmacy) return res.status(404).json({ error: "Pharmacie introuvable" });

  const s = getPharmacySchema();
  let weekToSave = null;
  if (req.body.horaires_semaine !== undefined) {
    weekToSave = parseWeekSchedule(req.body.horaires_semaine);
    const check = validateWeek(weekToSave);
    if (!check.ok) return res.status(400).json({ error: check.error });
  } else if (
    req.body.heure_ouverture !== undefined ||
    req.body.heure_fermeture !== undefined
  ) {
    await attachPharmacyHoraires(pharmacy);
    weekToSave = weekFromLegacy(
      req.body.heure_ouverture ?? pharmacy.heure_ouverture,
      req.body.heure_fermeture ?? pharmacy.heure_fermeture
    );
    if (weekToSave) {
      const check = validateWeek(weekToSave);
      if (!check.ok) return res.status(400).json({ error: check.error });
    }
  }

  const fields = [
    "nom",
    "adresse",
    "telephone",
    "latitude",
    "longitude",
    "est_de_garde",
  ];
  if (s.hasQuartier) fields.push("quartier");
  if (s.hasVille) fields.push("ville");
  if (req.body.imageDataUrl) {
    try {
      const imagePath = savePharmacyImageFromDataUrl(req.body.imageDataUrl);
      if (imagePath) {
        fields.push("image");
        req.body.image = imagePath;
      }
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  } else if (req.body.removeImage === true) {
    fields.push("image");
    req.body.image = null;
  }

  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }

  if (!updates.length) return res.status(400).json({ error: "Aucun champ à mettre à jour" });

  if (req.body.ville !== undefined || req.body.quartier !== undefined) {
    try {
      requireLocationColumns(s);
    } catch (err) {
      return res.status(503).json({ error: err.message });
    }
    const loc = validateVilleQuartier(
      req.body.ville !== undefined ? req.body.ville : pharmacy.ville,
      req.body.quartier !== undefined ? req.body.quartier : pharmacy.quartier
    );
    if (!loc.ok) {
      return res.status(400).json({ error: loc.errors.join(" ") });
    }
    if (req.body.ville !== undefined) {
      const i = updates.findIndex((u) => u.startsWith("ville"));
      if (i >= 0) values[i] = loc.ville;
    }
    if (req.body.quartier !== undefined) {
      const i = updates.findIndex((u) => u.startsWith("quartier"));
      if (i >= 0) values[i] = loc.quartier;
    }
  }

  try {
    await pool.query(`UPDATE pharmacies SET ${updates.join(", ")} WHERE id = ?`, [
      ...values,
      id,
    ]);

    if (weekToSave) {
      const saved = await saveNormalHours(id, weekToSave);
      if (!saved.ok) return res.status(400).json({ error: saved.error });
    }

    const updated = await getOwnedPharmacy(id, req.user.id);
    await attachPharmacyHoraires(updated);

    try {
      const nom = updated?.nom || pharmacy.nom;
      await notifyPharmacienPharmacyUpdated(req.user.id, id, nom);
    } catch (notifErr) {
      console.warn("Notification modification pharmacie:", notifErr.message);
    }

    res.json({ success: true, pharmacy: updated });
  } catch (err) {
    console.error("PUT pharmacie:", err);
    if (err.code === "ER_CONSTRAINT_FAILED" || err.errno === 4025) {
      return res.status(400).json({
        error: "Horaires invalides (format JSON). Réessayez ou contactez le support.",
      });
    }
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});

router.delete("/pharmacies/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });

  const pharmacy = await getOwnedPharmacy(id, req.user.id);
  if (!pharmacy) return res.status(404).json({ error: "Pharmacie introuvable" });

  try {
    const pharmacyName = pharmacy.nom;
    await pool.query(`DELETE FROM pharmacies WHERE id = ?`, [id]);

    try {
      await notifyPharmacienPharmacyDeleted(req.user.id, pharmacyName);
    } catch (notifErr) {
      console.warn("Notification suppression pharmacie:", notifErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/pharmacies/:id/avis", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });
  if (!(await getOwnedPharmacy(id, req.user.id))) {
    return res.status(404).json({ error: "Pharmacie introuvable" });
  }

  try {
    res.json(await queryAvisPharmacieList(id));
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") {
      return res.json({ note_moyenne: null, nb_avis: 0, avis: [] });
    }
    console.error("GET avis pharmacien:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/pharmacies/:id/stock", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });
  if (!(await getOwnedPharmacy(id, req.user.id))) {
    return res.status(404).json({ error: "Pharmacie introuvable" });
  }

  try {
    const rows = await queryPharmacienStockList(id);
    res.json(rows);
  } catch (err) {
    console.error("GET stock pharmacien:", err);
    res.status(500).json({
      error: "Erreur serveur",
      detail: err.message,
    });
  }
});

const STOCK_IMPORT_MAX = 500;

function parseStockPrix(prix) {
  if (prix === undefined || prix === null || String(prix).trim() === "") return null;
  const n = Number(String(prix).trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

async function resolveMedicamentId(nom, { description } = {}) {
  const name = String(nom || "").trim();
  if (!name) return null;
  const [existing] = await pool.query(`SELECT id FROM medicaments WHERE nom = ? LIMIT 1`, [name]);
  if (existing.length) return existing[0].id;
  const [ins] = await pool.query(
    `INSERT INTO medicaments (nom, description, prix) VALUES (?, ?, NULL)`,
    [name, description || null]
  );
  return ins.insertId;
}

async function upsertPharmacyStock(pharmacyId, { id_medicament, nom, description, prix, disponible }) {
  let medId = id_medicament;
  if (!medId && nom) {
    medId = await resolveMedicamentId(nom, { description });
  }
  if (!medId) return { ok: false, error: "nom_invalide" };

  const dispo = disponible === false ? 0 : 1;
  const price = parseStockPrix(prix);
  const [result] = await pool.query(
    `INSERT INTO stock_pharmacie (id_pharmacie, id_medicament, prix, disponible)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       disponible = VALUES(disponible),
       prix = IF(VALUES(prix) IS NOT NULL, VALUES(prix), prix)`,
    [pharmacyId, medId, price, dispo]
  );
  const created = result.affectedRows === 1;
  return { ok: true, created, disponible: dispo === 1 };
}

router.post("/pharmacies/:id/stock", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });
  if (!(await getOwnedPharmacy(id, req.user.id))) {
    return res.status(404).json({ error: "Pharmacie introuvable" });
  }

  const { id_medicament, nom, description, prix, disponible } = req.body;

  try {
    await ensureStockPharmacieSchemaOnce();
    const row = await upsertPharmacyStock(id, {
      id_medicament,
      nom,
      description,
      prix,
      disponible: disponible !== false,
    });
    if (!row.ok) return res.status(400).json({ error: "id_medicament ou nom requis" });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error("POST stock pharmacien:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/pharmacies/:id/stock/import", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant invalide" });
  if (!(await getOwnedPharmacy(id, req.user.id))) {
    return res.status(404).json({ error: "Pharmacie introuvable" });
  }

  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) {
    return res.status(400).json({ error: "Liste vide — ajoutez au moins un nom de médicament" });
  }
  if (items.length > STOCK_IMPORT_MAX) {
    return res.status(400).json({
      error: `Maximum ${STOCK_IMPORT_MAX} médicaments par import`,
    });
  }

  let imported = 0;
  let skipped = 0;
  const errors = [];

  try {
    await ensureStockPharmacieSchemaOnce();
    for (let i = 0; i < items.length; i++) {
      const raw = items[i];
      const nom = String(raw?.nom ?? raw ?? "").trim();
      if (nom.length < 2) {
        skipped++;
        continue;
      }
      const prix =
        raw && typeof raw === "object" && raw.prix !== undefined ? raw.prix : undefined;

      const row = await upsertPharmacyStock(id, { nom, disponible: true, prix });
      if (row.ok) imported++;
      else {
        skipped++;
        if (errors.length < 8) errors.push({ line: i + 1, nom, message: "Nom invalide" });
      }
    }

    res.status(201).json({
      success: true,
      imported,
      skipped,
      errors,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.put("/stock/:stockId", async (req, res) => {
  const stockId = parseId(req.params.stockId);
  if (!stockId) return res.status(400).json({ error: "Identifiant invalide" });

  const s = getPharmacySchema();
  const [rows] = await pool.query(
    `SELECT s.id, s.id_pharmacie FROM stock_pharmacie s
     INNER JOIN pharmacies p ON p.id = s.id_pharmacie
     WHERE s.id = ? AND ${ownerWhereClause("p")}`,
    [stockId, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Ligne stock introuvable" });

  const { disponible, prix, nom, description } = req.body;

  try {
    await ensureStockPharmacieSchemaOnce();
    const stockUpdates = [];
    const stockVals = [];

    if (disponible !== undefined) {
      stockUpdates.push("disponible = ?");
      stockVals.push(disponible === false || disponible === 0 ? 0 : 1);
    }
    if (prix !== undefined) {
      stockUpdates.push("prix = ?");
      stockVals.push(parseStockPrix(prix));
    }
    if (stockUpdates.length) {
      await pool.query(
        `UPDATE stock_pharmacie SET ${stockUpdates.join(", ")} WHERE id = ?`,
        [...stockVals, stockId]
      );
    }

    if (nom !== undefined || description !== undefined) {
      const [stock] = await pool.query(
        `SELECT id_medicament FROM stock_pharmacie WHERE id = ?`,
        [stockId]
      );
      const medUpdates = [];
      const medVals = [];
      if (nom !== undefined) {
        medUpdates.push("nom = ?");
        medVals.push(String(nom).trim());
      }
      if (description !== undefined) {
        medUpdates.push("description = ?");
        medVals.push(description);
      }
      if (medUpdates.length) {
        await pool.query(
          `UPDATE medicaments SET ${medUpdates.join(", ")} WHERE id = ?`,
          [...medVals, stock[0].id_medicament]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/stock/:stockId", async (req, res) => {
  const stockId = parseId(req.params.stockId);
  if (!stockId) return res.status(400).json({ error: "Identifiant invalide" });

  const [rows] = await pool.query(
    `SELECT s.id FROM stock_pharmacie s
     INNER JOIN pharmacies p ON p.id = s.id_pharmacie
     WHERE s.id = ? AND ${ownerWhereClause("p")}`,
    [stockId, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Ligne stock introuvable" });

  try {
    await pool.query(`DELETE FROM stock_pharmacie WHERE id = ?`, [stockId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/medicaments/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.status(400).json({ error: "Au moins 2 caractères" });

  try {
    const [rows] = await pool.query(
      `SELECT id, nom, description, prix FROM medicaments WHERE nom LIKE ? ORDER BY nom LIMIT 30`,
      [`%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.features = { manualClose: true };

module.exports = router;
