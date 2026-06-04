require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { signAuthToken } = require("../utils/authToken");
const pool = require("../config/db");

(async () => {
  const [u] = await pool.query("SELECT * FROM utilisateurs WHERE id = 1");
  const token = signAuthToken(u[0]);
  const url = "http://localhost:3000/api/pharmacien/pharmacies/7/marquer-ferme";
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  console.log("status", res.status);
  console.log("body", text.slice(0, 500));
  await pool.end();
})();
