const { getPharmacySchema } = require("./pharmacySchema");

function haversineKmSql() {
  return `(6371 * ACOS(LEAST(1, GREATEST(-1,
    COS(RADIANS(?)) * COS(RADIANS(p.latitude)) * COS(RADIANS(p.longitude) - RADIANS(?))
    + SIN(RADIANS(?)) * SIN(RADIANS(p.latitude))
  ))))`;
}

function getPublicPharmacySql() {
  return getPharmacySchema().PUBLIC_PHARMACY_SQL;
}

module.exports = { getPublicPharmacySql, haversineKmSql };
