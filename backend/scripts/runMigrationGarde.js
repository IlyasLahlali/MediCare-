require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS planning_garde (
      id INT PRIMARY KEY AUTO_INCREMENT,
      id_pharmacie INT NOT NULL,
      date_debut DATETIME NOT NULL,
      date_fin DATETIME NOT NULL,
      est_actif BOOLEAN DEFAULT true,
      FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE
    )
  `);

  console.log("OK — table planning_garde prête.");
  await conn.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
