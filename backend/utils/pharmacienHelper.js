const pool = require("../config/db");
const { getPharmacySchema } = require("./pharmacySchema");

async function getOwnedPharmacy(pharmacyId, userId) {
  const s = getPharmacySchema();
  const [rows] = await pool.query(
    `SELECT p.*, ${s.quartierSql} AS quartier, ${s.villeSql} AS ville
     FROM pharmacies p
     WHERE p.id = ? AND p.${s.ownerCol} = ?`,
    [pharmacyId, userId]
  );
  return rows[0] || null;
}

function ownerWhereClause(alias = "p") {
  const s = getPharmacySchema();
  return `${alias}.${s.ownerCol} = ?`;
}

module.exports = { getOwnedPharmacy, ownerWhereClause };
