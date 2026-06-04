require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const pool = require("../config/db");
const { loadPharmacySchema } = require("../utils/pharmacySchema");
const { getOwnedPharmacy } = require("../utils/pharmacienHelper");
const { setManualClose, isManualCloseActive } = require("../utils/pharmacyManualClose");

const pharmacyId = Number(process.argv[2]) || 7;
const userId = Number(process.argv[3]);

(async () => {
  await loadPharmacySchema();
  const [ph] = await pool.query("SELECT id, id_pharmacien, nom FROM pharmacies WHERE id = ?", [
    pharmacyId,
  ]);
  console.log("pharmacy:", ph[0] || "NOT FOUND");

  const [tables] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'horaires_exceptionnels'`
  );
  console.log("horaires_exceptionnels exists:", tables.length > 0);

  let uid = userId;
  if (!uid && ph[0]) {
    uid = ph[0].id_pharmacien || ph[0].id_proprietaire;
  }
  if (uid) {
    const owned = await getOwnedPharmacy(pharmacyId, uid);
    console.log("getOwnedPharmacy:", owned ? owned.nom : null);
  }

  const before = await isManualCloseActive(pharmacyId);
  console.log("manual close before:", before);

  const set = await setManualClose(pharmacyId, true);
  console.log("setManualClose(true):", set);

  const after = await isManualCloseActive(pharmacyId);
  console.log("manual close after:", after);

  await setManualClose(pharmacyId, false);
  console.log("reset manual close OK");

  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
