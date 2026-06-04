require("dotenv").config();
const pool = require("../config/db");
const { pharmacyOpenByScheduleSql } = require("../utils/pharmacyHorairesDb");
const { loadPharmacySchema } = require("../utils/pharmacySchema");

async function main() {
  await loadPharmacySchema();
  const id = parseInt(process.argv[2] || "2", 10);

  const [hours] = await pool.query(
    `SELECT jour, est_ferme, heure_ouverture, heure_fermeture
     FROM horaires_normaux WHERE id_pharmacie = ?
     ORDER BY FIELD(jour,'lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche')`,
    [id]
  );
  console.log("Horaires en base (pharmacie", id + "):");
  console.table(hours);

  const [[now]] = await pool.query(
    `SELECT DAYOFWEEK(CURDATE()) AS dow,
            ELT(DAYOFWEEK(CURDATE()),'dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi') AS jour_mysql,
            CURTIME() AS heure_mysql,
            CURDATE() AS date_mysql`
  );
  console.log("\nMaintenant (serveur MySQL):", now);

  const [[row]] = await pool.query(
    `SELECT (${pharmacyOpenByScheduleSql("p")}) AS ouverte_par_horaires
     FROM pharmacies p WHERE p.id = ?`,
    [id]
  );
  console.log("\nCalcul SQL « ouverte » aujourd'hui:", row?.ouverte_par_horaires);

  const jsDay = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][
    new Date().getDay()
  ];
  const jsTime = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;
  console.log("Maintenant (navigateur / Node local):", { jour: jsDay, heure: jsTime });

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
