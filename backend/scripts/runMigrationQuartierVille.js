/**
 * Ajoute les colonnes ville et quartier sur pharmacies.
 * Usage : npm run migrate:quartier-ville
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "Pharmacie_Garde",
  });

  for (const col of ["quartier", "ville"]) {
    try {
      const after = col === "quartier" ? "AFTER adresse" : "AFTER quartier";
      await conn.query(
        `ALTER TABLE pharmacies ADD COLUMN ${col} VARCHAR(100) NULL ${after}`
      );
      console.log(`Colonne ${col} ajoutée.`);
    } catch (e) {
      if (e.code !== "ER_DUP_FIELDNAME") throw e;
      console.log(`Colonne ${col} déjà présente.`);
    }
  }

  console.log(
    "OK — Les pharmaciens doivent renseigner ville et quartier ; l’adresse sert à la carte et à l’itinéraire."
  );
  console.log("Redémarrez le backend (npm start) après cette migration.");
  await conn.end();
}

main().catch((err) => {
  console.error("Erreur migration:", err.message);
  process.exit(1);
});
