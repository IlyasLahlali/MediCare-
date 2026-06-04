const express = require("express");
const pool = require("../config/db");
const { getPharmacySchema, requireLocationColumns } = require("../utils/pharmacySchema");
const { getPublicPharmacySql, haversineKmSql } = require("../utils/publicPharmacy");
const {
  gardePlanningSelectSql,
  gardeEffectiveSelectSql,
} = require("../utils/gardePublicSql");
const {
  pharmacyEffectiveOpenSelectSql,
  pharmacyCountsAsOpenSql,
  applyEffectiveOpenToRow,
} = require("../utils/pharmacyHours");
const { attachPharmacyHoraires, attachPharmacyHorairesList } = require("../utils/pharmacyHorairesDb");
const { gardeInProgressExistsSql } = require("../utils/gardePublicSql");

const router = express.Router();

function parseNumericId(id) {
  return /^\d+$/.test(String(id)) ? id : null;
}

function buildFiltersClause(query, s) {
  const parts = [];
  const values = [];
  const nom = String(query.nom || "").trim();
  const quartier = String(query.quartier || "").trim();
  const ville = String(query.ville || "").trim();

  if (nom) {
    parts.push("LOWER(p.nom) LIKE LOWER(?)");
    values.push(`%${nom}%`);
  }
  if (quartier) {
    parts.push(`${s.quartierSql} = ?`);
    values.push(quartier);
  }
  if (ville) {
    parts.push(`${s.villeSql} = ?`);
    values.push(ville);
  }

  return {
    sql: parts.length ? ` AND ${parts.join(" AND ")}` : "",
    values,
  };
}

async function getDbVilles(s) {
  const [rows] = await pool.query(
    `SELECT DISTINCT p.ville AS ville
     FROM pharmacies p
     WHERE ${getPublicPharmacySql()}
       AND p.ville IS NOT NULL AND TRIM(p.ville) != ''
     ORDER BY ville`
  );
  return rows.map((r) => r.ville).filter(Boolean);
}

function normalizeCity(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function citiesFromNominatim(addr, displayName) {
  const list = [
    addr.city,
    addr.town,
    addr.municipality,
    addr.city_district,
    addr.suburb,
    addr.county,
    addr.state,
  ].filter(Boolean);

  if (displayName) {
    const parts = displayName.split(",").map((p) => p.trim());
    if (parts.length >= 2) {
      list.push(parts[parts.length - 2], parts[parts.length - 1]);
    }
  }
  return [...new Set(list)];
}

function matchVilleToDb(candidates, dbVilles) {
  if (!dbVilles.length || !candidates.length) return null;

  for (const raw of candidates) {
    const d = normalizeCity(raw);
    if (!d || d.length < 2) continue;

    for (const v of dbVilles) {
      const nv = normalizeCity(v);
      if (d.includes(nv) || nv.includes(d)) return v;
    }

    const firstPart = d.split(/[-/]/)[0].trim();
    for (const v of dbVilles) {
      if (normalizeCity(v) === firstPart) return v;
    }
  }
  return null;
}

async function nearestPharmacyVille(lat, lon, s) {
  const distSql = haversineKmSql();
  const [nearest] = await pool.query(
    `SELECT ${s.villeSql} AS ville, ${distSql} AS distance_km
     FROM pharmacies p
     WHERE ${getPublicPharmacySql()}
       AND ${s.villeSql} IS NOT NULL AND TRIM(${s.villeSql}) != ''
       AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
     ORDER BY distance_km ASC
     LIMIT 1`,
    [lat, lon, lat]
  );
  return nearest[0]?.ville || null;
}

router.get("/filtres", async (req, res) => {
  try {
    const s = getPharmacySchema();
    requireLocationColumns(s);
    const villeFilter = String(req.query.ville || "").trim();

    let sql = `
      SELECT DISTINCT p.quartier AS quartier
      FROM pharmacies p
      WHERE ${getPublicPharmacySql()}
        AND p.quartier IS NOT NULL AND TRIM(p.quartier) != ''`;
    const params = [];
    if (villeFilter) {
      sql += ` AND p.ville = ?`;
      params.push(villeFilter);
    }
    sql += ` ORDER BY quartier`;

    const [quartiers] = await pool.query(sql, params);
    const villes = villeFilter ? [] : await getDbVilles(s);
    res.json({
      quartiers: quartiers.map((r) => r.quartier).filter(Boolean),
      villes,
    });
  } catch (err) {
    if (err.code === "MC_LOCATION_COLUMNS") {
      return res.status(503).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/ville-auto", async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "lat et lon requis" });
  }

  const s = getPharmacySchema();

  try {
    const dbVilles = await getDbVilles(s);
    let ville = null;
    let label = null;
    let source = "none";
    const candidates = [];

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr&zoom=10`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, {
        headers: { "User-Agent": "MediCarePlus/1.0 (contact@medicare.local)" },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        candidates.push(...citiesFromNominatim(data.address || {}, data.display_name));
        ville = matchVilleToDb(candidates, dbVilles);
        if (ville) {
          source = "geoloc";
        } else if (candidates.length) {
          label = candidates.find((c) => c.length > 2) || null;
        }
      }
    } catch (geoErr) {
      console.warn("Géocodage inverse:", geoErr.message);
    }

    if (!ville) {
      const near = await nearestPharmacyVille(lat, lon, s);
      if (near) {
        ville = near;
        source = "proximite";
      }
    }

    if (!label && ville) label = ville;
    if (!label && candidates.length) label = candidates[0];

    res.json({
      ville,
      label,
      source,
      hasPharmacies: dbVilles.length > 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/", async (req, res) => {
  const s = getPharmacySchema();
  const ouvertesOnly = req.query.ouvertes === "1";
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lon);
  const filters = buildFiltersClause(req.query, s);
  const searchByNom = !!String(req.query.nom || "").trim();

  try {
    let selectExtra = "";
    const params = [];

    if (hasGeo) {
      selectExtra = `, ${haversineKmSql()} AS distance_km`;
      params.push(lat, lon, lat);
    }

    let sql = `
      SELECT p.id, p.nom, p.adresse,
             ${s.quartierSql} AS quartier, ${s.villeSql} AS ville,
             p.latitude, p.longitude, p.telephone, p.image,
             ${pharmacyEffectiveOpenSelectSql()},
             ${gardeEffectiveSelectSql()},
             ${gardePlanningSelectSql()}
             ${selectExtra}
      FROM pharmacies p
      WHERE ${getPublicPharmacySql()}`;

    if (ouvertesOnly) {
      sql += ` AND ${pharmacyCountsAsOpenSql()}`;
    }

    sql += filters.sql;
    params.push(...filters.values);

    if (hasGeo && !searchByNom) {
      sql += ` AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL`;
    }

    if (hasGeo) {
      sql += ` ORDER BY (p.latitude IS NULL OR p.longitude IS NULL), distance_km ASC, p.nom`;
    } else {
      sql += ` ORDER BY est_de_garde DESC, (${pharmacyCountsAsOpenSql()}) DESC, p.nom`;
    }

    const [rows] = await pool.query(sql, params);
    await attachPharmacyHorairesList(rows);
    for (const row of rows) applyEffectiveOpenToRow(row);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/** Statistiques publiques pour l’accueil (sans authentification). */
router.get("/public-stats", async (req, res) => {
  try {
    const s = getPharmacySchema();
    const publicWhere = getPublicPharmacySql();

    const [[pharmaciesRow]] = await pool.query(
      `SELECT COUNT(*) AS n FROM pharmacies p WHERE ${publicWhere}`
    );

    const [[villesRow]] = await pool.query(
      `SELECT COUNT(DISTINCT ${s.villeSql}) AS n
       FROM pharmacies p
       WHERE ${publicWhere}
         AND ${s.villeSql} IS NOT NULL AND TRIM(${s.villeSql}) != ''`
    );

    const [[medicamentsRow]] = await pool.query(
      `SELECT COUNT(DISTINCT m.id) AS n
       FROM medicaments m
       INNER JOIN stock_pharmacie st ON st.id_medicament = m.id AND st.disponible = 1
       INNER JOIN pharmacies p ON p.id = st.id_pharmacie
       WHERE ${publicWhere}`
    );

    const [[ouvertesRow]] = await pool.query(
      `SELECT COUNT(*) AS n FROM pharmacies p
       WHERE ${publicWhere} AND ${pharmacyCountsAsOpenSql()}`
    );

    const [[gardeRow]] = await pool.query(
      `SELECT COUNT(*) AS n FROM pharmacies p
       WHERE ${publicWhere} AND ${gardeInProgressExistsSql("p")}`
    );

    let recherches_mois = 0;
    let consultations_mois = 0;
    try {
      const [[rechRow]] = await pool.query(
        `SELECT COALESCE(SUM(s.total), 0) AS n
         FROM statistiques_pharmacie s
         INNER JOIN pharmacies p ON p.id = s.id_pharmacie
         WHERE ${publicWhere}
           AND s.type = 'RECHERCHE'
           AND s.date_jour >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
      );
      recherches_mois = Number(rechRow?.n || 0);

      const [[vueRow]] = await pool.query(
        `SELECT COALESCE(SUM(s.total), 0) AS n
         FROM statistiques_pharmacie s
         INNER JOIN pharmacies p ON p.id = s.id_pharmacie
         WHERE ${publicWhere}
           AND s.type IN ('VUE', 'APPEL')
           AND s.date_jour >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
      );
      consultations_mois = Number(vueRow?.n || 0);
    } catch (statsErr) {
      if (statsErr.code !== "ER_NO_SUCH_TABLE") throw statsErr;
    }

    res.json({
      pharmacies: Number(pharmaciesRow?.n || 0),
      villes: Number(villesRow?.n || 0),
      medicaments: Number(medicamentsRow?.n || 0),
      pharmacies_ouvertes: Number(ouvertesRow?.n || 0),
      pharmacies_garde: Number(gardeRow?.n || 0),
      recherches_mois,
      consultations_mois,
      service_en_ligne_24_7: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/:id", async (req, res) => {
  const pharmacyId = parseNumericId(req.params.id);
  if (!pharmacyId) return res.status(400).json({ error: "Identifiant invalide" });

  const s = getPharmacySchema();
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lon);

  try {
    let sql = `
      SELECT p.*, ${s.quartierSql} AS quartier, ${s.villeSql} AS ville,
             ${gardePlanningSelectSql()}`;
    const params = [];

    if (hasGeo) {
      sql += `, ${haversineKmSql()} AS distance_km`;
      params.push(lat, lon, lat);
    }

    sql += ` FROM pharmacies p WHERE p.id = ? AND ${getPublicPharmacySql()}`;
    params.push(pharmacyId);

    const [rows] = await pool.query(sql, params);
    if (!rows.length) return res.status(404).json({ error: "Pharmacie introuvable" });
    const row = rows[0];
    row.est_de_garde = !!(row.garde_date_debut && row.garde_date_fin);
    await attachPharmacyHoraires(row);
    applyEffectiveOpenToRow(row);
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
