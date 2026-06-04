require("dotenv").config();
const pool = require("../config/db");

pool
  .query(
    `SELECT id, nom, horaires_semaine IS NULL AS hs_null,
            heure_ouverture, heure_fermeture
     FROM pharmacies ORDER BY id`
  )
  .then(([rows]) => {
    console.table(rows);
    process.exit(0);
  });
