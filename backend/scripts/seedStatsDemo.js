require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
  });

  const [pharmacies] = await conn.query("SELECT id FROM pharmacies LIMIT 5");
  for (const { id } of pharmacies) {
    for (const [type, total] of [
      ["VUE", 24],
      ["APPEL", 8],
      ["RECHERCHE", 12],
    ]) {
      await conn.query(
        `INSERT INTO statistiques_pharmacie (id_pharmacie, type, date_jour, total)
         VALUES (?, ?, CURDATE(), ?)
         ON DUPLICATE KEY UPDATE total = GREATEST(total, VALUES(total))`,
        [id, type, total]
      );
    }
  }

  const [[{ n }]] = await conn.query("SELECT COUNT(*) AS n FROM statistiques_pharmacie");
  console.log(`Données démo : ${n} ligne(s) de statistiques.`);
  await conn.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
