require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const pool = require("../config/db");
const { ensureStockPharmacieSchema } = require("../utils/ensureStockPharmacieSchema");

(async () => {
  await ensureStockPharmacieSchema();
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_pharmacie'
     ORDER BY ORDINAL_POSITION`
  );
  console.log("columns:", cols.map((r) => r.COLUMN_NAME).join(", "));
  const [rows] = await pool.query(
    `SELECT s.id, s.prix, s.disponible, m.nom
     FROM stock_pharmacie s
     INNER JOIN medicaments m ON m.id = s.id_medicament
     LIMIT 3`
  );
  console.log("sample:", rows);
  process.exit(0);
})().catch((e) => {
  console.error("FAIL:", e.code, e.message);
  process.exit(1);
});
