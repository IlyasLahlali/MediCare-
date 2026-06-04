require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const pool = require("../config/db");

const BASE = process.env.TEST_API_BASE || "http://localhost:3000/api";
const EMAIL = process.env.TEST_PHARMA_EMAIL || "pharma@medicare.ma";
const PASS = process.env.TEST_PHARMA_PASS || "admin123";

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

(async () => {
  const login = await jsonFetch(`${BASE}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, mot_de_passe: PASS }),
  });
  console.log("login", login.status, login.data.error || "ok");
  if (!login.data.token) process.exit(1);

  const token = login.data.token;
  const auth = { Authorization: `Bearer ${token}` };

  const [owned] = await pool.query(
    `SELECT p.id, p.nom FROM pharmacies p
     INNER JOIN utilisateurs u ON u.id = p.id_pharmacien
     WHERE u.email = ? ORDER BY p.id LIMIT 1`,
    [EMAIL]
  );
  let id = owned[0]?.id;
  console.log("owned pharmacy:", owned[0] || "none");

  if (!id) {
    const { signAuthToken } = require("../utils/authToken");
    const [u1] = await pool.query("SELECT * FROM utilisateurs WHERE id = 1");
    if (u1[0]) {
      const token1 = signAuthToken(u1[0]);
      auth.Authorization = `Bearer ${token1}`;
      id = 7;
      console.log("fallback: test pharmacy 7 as user", u1[0].email);
    }
  }

  if (!id) {
    console.log("No pharmacy to test");
    process.exit(1);
  }

  const close = await jsonFetch(`${BASE}/pharmacien/pharmacies/${id}/marquer-ferme`, {
    method: "POST",
    headers: auth,
  });
  console.log("marquer-ferme", close.status, close.data);

  const get = await jsonFetch(`${BASE}/pharmacien/pharmacies/${id}`, { headers: auth });
  console.log("GET pharmacy fermeture_manuelle:", get.data?.fermeture_manuelle, "est_ouverte:", get.data?.est_ouverte);

  const open = await jsonFetch(`${BASE}/pharmacien/pharmacies/${id}/marquer-ouverte`, {
    method: "POST",
    headers: auth,
  });
  console.log("marquer-ouverte", open.status, open.data);

  const bad = await jsonFetch(`${BASE}/pharmacien/pharmacies/99999/marquer-ferme`, {
    method: "POST",
    headers: auth,
  });
  console.log("wrong id (expect 404):", bad.status, bad.data.error);

  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
