require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { ensureStockPharmacieSchema, invalidateStockSchemaCache } = require("../utils/ensureStockPharmacieSchema");

(async () => {
  invalidateStockSchemaCache();
  await ensureStockPharmacieSchema();
  console.log("Migration stock_pharmacie terminée (prix + disponible, sans quantite).");
  process.exit(0);
})().catch((err) => {
  console.error("Échec migration stock:", err.message);
  process.exit(1);
});
