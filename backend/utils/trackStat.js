const pool = require("../config/db");

const VALID_TYPES = ["VUE", "APPEL", "RECHERCHE"];

async function incrementStat(pharmacyId, type) {
  if (!VALID_TYPES.includes(type)) return;
  await pool.query(
    `INSERT INTO statistiques_pharmacie (id_pharmacie, type, date_jour, total)
     VALUES (?, ?, CURDATE(), 1)
     ON DUPLICATE KEY UPDATE total = total + 1`,
    [pharmacyId, type]
  );
}

module.exports = { incrementStat, VALID_TYPES };
