require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const pool = require("../config/db");
const { loadPharmacySchema, getPharmacySchema } = require("../utils/pharmacySchema");
const { ownerWhereClause } = require("../utils/pharmacienHelper");

(async () => {
  await loadPharmacySchema();
  const days = 7;
  const [users] = await pool.query(
    "SELECT id, nom, email FROM utilisateurs WHERE role = 'PHARMACIEN'"
  );
  console.log("pharmaciens:", users);

  for (const user of users) {
    const req = { user: { id: user.id } };
    const ownerSql = ownerWhereClause("p");
    try {
      const [totals] = await pool.query(
        `SELECT s.type, COALESCE(SUM(s.total), 0) AS total
         FROM statistiques_pharmacie s
         INNER JOIN pharmacies p ON p.id = s.id_pharmacie
         WHERE ${ownerSql}
           AND s.date_jour >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY s.type`,
        [req.user.id, days - 1]
      );
      console.log(user.nom, "totals", totals);

      const [daily] = await pool.query(
        `SELECT s.date_jour AS jour,
                SUM(CASE WHEN s.type = 'VUE' THEN s.total ELSE 0 END) AS vues,
                SUM(s.total) AS total
         FROM statistiques_pharmacie s
         INNER JOIN pharmacies p ON p.id = s.id_pharmacie
         WHERE ${ownerSql}
           AND s.date_jour >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY s.date_jour
         ORDER BY s.date_jour ASC`,
        [req.user.id, days - 1]
      );
      console.log(user.nom, "daily rows", daily.length);

      const [byPharmacy] = await pool.query(
        `SELECT p.id, p.nom,
                SUM(CASE WHEN s.type = 'VUE' THEN s.total ELSE 0 END) AS vues,
                SUM(CASE WHEN s.type = 'APPEL' THEN s.total ELSE 0 END) AS appels,
                SUM(CASE WHEN s.type = 'RECHERCHE' THEN s.total ELSE 0 END) AS recherches
         FROM pharmacies p
         LEFT JOIN statistiques_pharmacie s ON s.id_pharmacie = p.id
           AND s.date_jour >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         WHERE ${ownerSql}
         GROUP BY p.id, p.nom
         ORDER BY (
           SUM(CASE WHEN s.type = 'VUE' THEN s.total ELSE 0 END) +
           SUM(CASE WHEN s.type = 'APPEL' THEN s.total ELSE 0 END) +
           SUM(CASE WHEN s.type = 'RECHERCHE' THEN s.total ELSE 0 END)
         ) DESC`,
        [days - 1, req.user.id]
      );
      console.log(user.nom, "byPharmacy", byPharmacy.length, "OK");
    } catch (e) {
      console.error(user.nom, "FAIL", e.code, e.message);
    }
  }
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
