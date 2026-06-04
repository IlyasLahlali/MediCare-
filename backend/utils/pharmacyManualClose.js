const pool = require("../config/db");
const { tableExists } = require("./pharmacyHorairesDb");
const { applyEffectiveOpenToRow } = require("./pharmacyHours");

const MANUAL_CLOSE_MOTIF = "manuel_pharmacien";

async function isManualCloseActive(pharmacyId) {
  if (!(await tableExists("horaires_exceptionnels"))) return false;
  const [rows] = await pool.query(
    `SELECT 1 FROM horaires_exceptionnels
     WHERE id_pharmacie = ?
       AND motif = ?
       AND est_ferme = 1
       AND CURDATE() BETWEEN date_debut AND date_fin
     LIMIT 1`,
    [pharmacyId, MANUAL_CLOSE_MOTIF]
  );
  return rows.length > 0;
}

async function setManualClose(pharmacyId, closed) {
  if (!(await tableExists("horaires_exceptionnels"))) {
    return { ok: false, error: "Horaires exceptionnels non disponibles (migration requise)." };
  }

  await pool.query(
    `DELETE FROM horaires_exceptionnels
     WHERE id_pharmacie = ? AND motif = ? AND CURDATE() BETWEEN date_debut AND date_fin`,
    [pharmacyId, MANUAL_CLOSE_MOTIF]
  );

  if (closed) {
    await pool.query(
      `INSERT INTO horaires_exceptionnels
         (id_pharmacie, date_debut, date_fin, est_ferme, heure_ouverture, heure_fermeture, motif)
       VALUES (?, CURDATE(), CURDATE(), 1, NULL, NULL, ?)`,
      [pharmacyId, MANUAL_CLOSE_MOTIF]
    );
  }

  return { ok: true, fermeture_manuelle: !!closed };
}

async function attachManualCloseFlag(row) {
  if (!row?.id) return row;
  row.fermeture_manuelle = await isManualCloseActive(row.id);
  applyEffectiveOpenToRow(row);
  if (row.fermeture_manuelle && !row.est_de_garde) {
    row.est_ouverte = false;
  }
  return row;
}

module.exports = {
  MANUAL_CLOSE_MOTIF,
  isManualCloseActive,
  setManualClose,
  attachManualCloseFlag,
};
