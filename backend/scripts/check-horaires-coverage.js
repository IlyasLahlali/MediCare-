require("dotenv").config();
const pool = require("../config/db");

async function main() {
  const [rows] = await pool.query(
    `SELECT p.id, p.nom, p.statut_admin,
            COUNT(hn.id) AS jours_horaires,
            (SELECT COUNT(*) FROM horaires_exceptionnels he WHERE he.id_pharmacie = p.id) AS exceptions
     FROM pharmacies p
     LEFT JOIN horaires_normaux hn ON hn.id_pharmacie = p.id
     GROUP BY p.id, p.nom, p.statut_admin
     ORDER BY p.id`
  );
  console.table(rows);
  const missing = rows.filter((r) => Number(r.jours_horaires) === 0);
  if (missing.length) {
    console.log("\nSans horaires_normaux:", missing.map((r) => r.id).join(", "));
  } else {
    console.log("\nToutes les pharmacies ont au moins 1 ligne horaires_normaux.");
    const incomplete = rows.filter((r) => Number(r.jours_horaires) > 0 && Number(r.jours_horaires) < 7);
    if (incomplete.length) {
      console.log("Horaires incomplets (< 7 jours):", incomplete);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
