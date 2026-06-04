require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const {
  ensurePharmacyStatutAdminSchema,
} = require("../utils/ensurePharmacyStatutAdminSchema");

ensurePharmacyStatutAdminSchema()
  .then(() => {
    console.log("OK — statut_admin prêt, est_active supprimée si présente.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
