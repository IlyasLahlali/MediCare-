require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const pool = require("../config/db");
pool
  .query(
    `SELECT u.id AS user_id, u.email, p.id AS pharmacy_id, p.nom
     FROM utilisateurs u
     LEFT JOIN pharmacies p ON p.id_pharmacien = u.id
     WHERE u.role = 'PHARMACIEN'`
  )
  .then(([r]) => {
    console.table(r);
    process.exit(0);
  });
