const pool = require("../config/db");
const {
  DAY_KEYS,
  parseWeekSchedule,
  weekFromLegacy,
  defaultWeek,
  legacyTimesFromWeek,
  validateWeek,
  normalizeTime,
} = require("./weeklyPharmacyHours");

const JOUR_ELT =
  "ELT(DAYOFWEEK(CURDATE()), 'dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi')";

/** false = considérer fermé (tables horaires absentes). */
let useRelationalHorairesInSql = true;

async function refreshHorairesSqlMode() {
  const hasNormal = await tableExists("horaires_normaux");
  const hasExc = await tableExists("horaires_exceptionnels");
  useRelationalHorairesInSql = hasNormal && hasExc;
  return useRelationalHorairesInSql;
}

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function tableExists(table) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows.length > 0;
}

/** SQL : pharmacie ouverte selon exception du jour, sinon horaires_normaux, sinon fermé. */
function pharmacyOpenByScheduleSql(alias = "p") {
  const a = alias;
  if (!useRelationalHorairesInSql) {
    return `0`;
  }
  return `(CASE
    WHEN EXISTS (
      SELECT 1 FROM horaires_exceptionnels he
      WHERE he.id_pharmacie = ${a}.id
        AND CURDATE() BETWEEN he.date_debut AND he.date_fin
        AND he.est_ferme = 1
    ) THEN 0
    WHEN EXISTS (
      SELECT 1 FROM horaires_exceptionnels he
      WHERE he.id_pharmacie = ${a}.id
        AND CURDATE() BETWEEN he.date_debut AND he.date_fin
        AND he.est_ferme = 0
        AND he.heure_ouverture IS NOT NULL
        AND he.heure_fermeture IS NOT NULL
    ) THEN (
      SELECT CASE
        WHEN he.heure_ouverture < he.heure_fermeture THEN
          (CURTIME() >= he.heure_ouverture AND CURTIME() < he.heure_fermeture)
        ELSE
          (CURTIME() >= he.heure_ouverture OR CURTIME() < he.heure_fermeture)
      END
      FROM horaires_exceptionnels he
      WHERE he.id_pharmacie = ${a}.id
        AND CURDATE() BETWEEN he.date_debut AND he.date_fin
      ORDER BY he.date_debut DESC
      LIMIT 1
    )
    WHEN EXISTS (
      SELECT 1 FROM horaires_normaux hn
      WHERE hn.id_pharmacie = ${a}.id AND hn.jour = ${JOUR_ELT}
    ) THEN (
      SELECT CASE
        WHEN hn.est_ferme = 1 THEN 0
        WHEN hn.heure_ouverture IS NULL OR hn.heure_fermeture IS NULL THEN 0
        WHEN hn.heure_ouverture < hn.heure_fermeture THEN
          (CURTIME() >= hn.heure_ouverture AND CURTIME() < hn.heure_fermeture)
        ELSE
          (CURTIME() >= hn.heure_ouverture OR CURTIME() < hn.heure_fermeture)
      END
      FROM horaires_normaux hn
      WHERE hn.id_pharmacie = ${a}.id AND hn.jour = ${JOUR_ELT}
      LIMIT 1
    )
    ELSE 0
  END)`;
}

function weekFromRows(rows) {
  if (!rows?.length) return null;
  const byJour = Object.fromEntries(rows.map((r) => [r.jour, r]));
  const out = {};
  for (const key of DAY_KEYS) {
    const r = byJour[key];
    if (!r || r.est_ferme) {
      out[key] = { closed: true, open: null, close: null };
    } else {
      out[key] = {
        closed: false,
        open: normalizeTime(r.heure_ouverture),
        close: normalizeTime(r.heure_fermeture),
      };
    }
  }
  return out;
}

async function fetchNormalHoursRows(pharmacyId) {
  const [rows] = await pool.query(
    `SELECT jour, est_ferme, heure_ouverture, heure_fermeture
     FROM horaires_normaux WHERE id_pharmacie = ? ORDER BY FIELD(jour,
       'lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche')`,
    [pharmacyId]
  );
  return rows;
}

async function attachPharmacyHoraires(row) {
  if (!row?.id || !useRelationalHorairesInSql) return row;
  const week = weekFromRows(await fetchNormalHoursRows(row.id));
  if (week) {
    row.horaires_semaine = week;
    const legacy = legacyTimesFromWeek(week);
    row.heure_ouverture = legacy.heure_ouverture;
    row.heure_fermeture = legacy.heure_fermeture;
  } else {
    row.horaires_semaine = null;
    row.heure_ouverture = null;
    row.heure_fermeture = null;
  }
  return row;
}

async function attachPharmacyHorairesList(rows) {
  if (!rows?.length || !useRelationalHorairesInSql) return rows;
  const ids = rows.map((r) => r.id).filter(Boolean);
  if (!ids.length) return rows;

  const [all] = await pool.query(
    `SELECT id_pharmacie, jour, est_ferme, heure_ouverture, heure_fermeture
     FROM horaires_normaux WHERE id_pharmacie IN (?)`,
    [ids]
  );
  const byPharmacy = {};
  for (const r of all) {
    if (!byPharmacy[r.id_pharmacie]) byPharmacy[r.id_pharmacie] = [];
    byPharmacy[r.id_pharmacie].push(r);
  }
  for (const row of rows) {
    const week = weekFromRows(byPharmacy[row.id] || []);
    if (week) {
      row.horaires_semaine = week;
      const legacy = legacyTimesFromWeek(week);
      row.heure_ouverture = legacy.heure_ouverture;
      row.heure_fermeture = legacy.heure_fermeture;
    }
  }
  return rows;
}

async function saveNormalHours(pharmacyId, week) {
  const check = validateWeek(week);
  if (!check.ok) return check;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM horaires_normaux WHERE id_pharmacie = ?`, [pharmacyId]);
    for (const key of DAY_KEYS) {
      const d = week[key];
      const estFerme = d?.closed ? 1 : 0;
      await conn.query(
        `INSERT INTO horaires_normaux (id_pharmacie, jour, est_ferme, heure_ouverture, heure_fermeture)
         VALUES (?, ?, ?, ?, ?)`,
        [pharmacyId, key, estFerme, estFerme ? null : d.open, estFerme ? null : d.close]
      );
    }
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function resolveWeekFromPharmacyRow(p) {
  return (
    parseWeekSchedule(p?.horaires_semaine) ||
    weekFromLegacy(p?.heure_ouverture, p?.heure_fermeture) ||
    defaultWeek()
  );
}

async function migratePharmacyHoursFromLegacyColumns() {
  const hasLegacy =
    (await columnExists("pharmacies", "horaires_semaine")) ||
    (await columnExists("pharmacies", "heure_ouverture"));

  if (!hasLegacy) return;

  const cols = ["id"];
  if (await columnExists("pharmacies", "heure_ouverture")) cols.push("heure_ouverture");
  if (await columnExists("pharmacies", "heure_fermeture")) cols.push("heure_fermeture");
  if (await columnExists("pharmacies", "horaires_semaine")) cols.push("horaires_semaine");

  const [pharmacies] = await pool.query(`SELECT ${cols.join(", ")} FROM pharmacies`);

  for (const p of pharmacies) {
    const [cnt] = await pool.query(
      `SELECT COUNT(*) AS c FROM horaires_normaux WHERE id_pharmacie = ?`,
      [p.id]
    );
    if (Number(cnt[0]?.c) > 0) continue;

    const week = resolveWeekFromPharmacyRow(p);
    try {
      const saved = await saveNormalHours(p.id, week);
      if (!saved.ok) {
        console.warn(`Migration horaires pharmacie ${p.id}:`, saved.error);
      }
    } catch (err) {
      console.warn(`Migration horaires pharmacie ${p.id}:`, err.message);
    }
  }

  for (const col of ["horaires_semaine", "heure_ouverture", "heure_fermeture"]) {
    if (await columnExists("pharmacies", col)) {
      await pool.query(`ALTER TABLE pharmacies DROP COLUMN ${col}`);
      console.log(`Migration : colonne pharmacies.${col} supprimée.`);
    }
  }
}

async function ensurePharmacyHorairesTablesSchema() {
  await refreshHorairesSqlMode();

  if (!(await tableExists("horaires_normaux"))) {
    await pool.query(`
      CREATE TABLE horaires_normaux (
        id INT PRIMARY KEY AUTO_INCREMENT,
        id_pharmacie INT NOT NULL,
        jour ENUM('lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche') NOT NULL,
        est_ferme TINYINT(1) NOT NULL DEFAULT 0,
        heure_ouverture TIME NULL,
        heure_fermeture TIME NULL,
        UNIQUE KEY uk_horaires_normaux_pharmacie_jour (id_pharmacie, jour),
        CONSTRAINT fk_horaires_normaux_pharmacie
          FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("Migration : table horaires_normaux créée.");
  }

  if (!(await tableExists("horaires_exceptionnels"))) {
    await pool.query(`
      CREATE TABLE horaires_exceptionnels (
        id INT PRIMARY KEY AUTO_INCREMENT,
        id_pharmacie INT NOT NULL,
        date_debut DATE NOT NULL,
        date_fin DATE NOT NULL,
        est_ferme TINYINT(1) NOT NULL DEFAULT 0,
        heure_ouverture TIME NULL,
        heure_fermeture TIME NULL,
        motif VARCHAR(200) NULL,
        KEY idx_horaires_exc_pharmacie_dates (id_pharmacie, date_debut, date_fin),
        CONSTRAINT fk_horaires_exc_pharmacie
          FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("Migration : table horaires_exceptionnels créée.");
  }

  await migratePharmacyHoursFromLegacyColumns();

  const [empty] = await pool.query(
    `SELECT p.id FROM pharmacies p
     LEFT JOIN horaires_normaux hn ON hn.id_pharmacie = p.id
     WHERE hn.id IS NULL LIMIT 200`
  );
  for (const row of empty) {
    try {
      await saveNormalHours(row.id, defaultWeek());
    } catch (err) {
      console.warn(`Backfill horaires pharmacie ${row.id}:`, err.message);
    }
  }

  await dropPharmacyEstOuverteColumn();
  await refreshHorairesSqlMode();
}

async function dropPharmacyEstOuverteColumn() {
  if (await columnExists("pharmacies", "est_ouverte")) {
    await pool.query(`ALTER TABLE pharmacies DROP COLUMN est_ouverte`);
    console.log("Migration : colonne pharmacies.est_ouverte supprimée.");
  }
}

let schemaReady = null;

function ensurePharmacyHorairesTablesSchemaOnce() {
  if (!schemaReady) {
    schemaReady = ensurePharmacyHorairesTablesSchema().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

module.exports = {
  pharmacyOpenByScheduleSql,
  refreshHorairesSqlMode,
  fetchNormalHoursRows,
  weekFromRows,
  attachPharmacyHoraires,
  attachPharmacyHorairesList,
  saveNormalHours,
  ensurePharmacyHorairesTablesSchema,
  ensurePharmacyHorairesTablesSchemaOnce,
  tableExists,
};
