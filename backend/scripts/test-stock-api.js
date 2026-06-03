require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { loadPharmacySchema } = require("../utils/pharmacySchema");

(async () => {
  await loadPharmacySchema();
  const s = require("../utils/pharmacySchema").getPharmacySchema();
  const [ph] = await pool.query(
    `SELECT p.id AS pharmacy_id, p.${s.ownerCol} AS user_id FROM pharmacies p LIMIT 1`
  );
  if (!ph.length) {
    console.log("No pharmacy");
    process.exit(1);
  }
  const { pharmacy_id, user_id } = ph[0];
  console.log("pharmacy", pharmacy_id, "user", user_id);

  const token = jwt.sign(
    { id: user_id, role: "PHARMACIEN" },
    process.env.JWT_SECRET || "medicare_secret",
    { expiresIn: "1h" }
  );

  const res = await fetch(`http://localhost:3000/api/pharmacien/pharmacies/${pharmacy_id}/stock`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  console.log("status", res.status, JSON.stringify(data, null, 2));
  process.exit(res.ok ? 0 : 1);
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
