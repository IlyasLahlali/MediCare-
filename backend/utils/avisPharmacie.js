const pool = require("../config/db");

async function queryAvisPharmacieList(pharmacyId) {
  const [stats] = await pool.query(
    `SELECT ROUND(AVG(note), 1) AS note_moyenne, COUNT(*) AS nb_avis
     FROM avis_pharmacie WHERE id_pharmacie = ?`,
    [pharmacyId]
  );
  const [avis] = await pool.query(
    `SELECT a.id, a.note, a.commentaire, a.date_creation, u.nom AS nom_utilisateur
     FROM avis_pharmacie a
     INNER JOIN utilisateurs u ON u.id = a.id_utilisateur
     WHERE a.id_pharmacie = ?
     ORDER BY a.date_creation DESC`,
    [pharmacyId]
  );
  return {
    note_moyenne: stats[0]?.note_moyenne ?? null,
    nb_avis: Number(stats[0]?.nb_avis) || 0,
    avis,
  };
}

module.exports = { queryAvisPharmacieList };
