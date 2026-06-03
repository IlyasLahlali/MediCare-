require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS favoris_pharmacie (
      id INT PRIMARY KEY AUTO_INCREMENT,
      id_utilisateur INT NOT NULL,
      id_pharmacie INT NOT NULL,
      date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(id_utilisateur, id_pharmacie),
      FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE,
      FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS avis_pharmacie (
      id INT PRIMARY KEY AUTO_INCREMENT,
      id_utilisateur INT NOT NULL,
      id_pharmacie INT NOT NULL,
      note TINYINT NOT NULL,
      commentaire TEXT,
      date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(id_utilisateur, id_pharmacie),
      FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE,
      FOREIGN KEY (id_pharmacie) REFERENCES pharmacies(id) ON DELETE CASCADE,
      CHECK (note >= 1 AND note <= 5)
    );
  `);

  console.log("OK — tables favoris_pharmacie et avis_pharmacie prêtes.");
  await conn.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
