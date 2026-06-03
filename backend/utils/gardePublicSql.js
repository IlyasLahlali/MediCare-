/** Garde en cours = période active maintenant (planning_garde). */
function gardeInProgressExistsSql(pharmacyAlias = "p") {
  return `EXISTS (
    SELECT 1 FROM planning_garde pg
    WHERE pg.id_pharmacie = ${pharmacyAlias}.id
      AND pg.est_actif = 1
      AND pg.date_debut <= NOW()
      AND pg.date_fin >= NOW()
  )`;
}

/** Affichage public : « de garde » uniquement pendant la période. */
function gardeEffectiveSelectSql() {
  return `(${gardeInProgressExistsSql("p")}) AS est_de_garde`;
}

function gardePlanningSelectSql() {
  const active = `
    pg.id_pharmacie = p.id
    AND pg.est_actif = 1
    AND pg.date_debut <= NOW()
    AND pg.date_fin >= NOW()`;
  return `
    (SELECT pg.date_debut FROM planning_garde pg
      WHERE ${active} ORDER BY pg.date_debut DESC LIMIT 1) AS garde_date_debut,
    (SELECT pg.date_fin FROM planning_garde pg
      WHERE ${active} ORDER BY pg.date_debut DESC LIMIT 1) AS garde_date_fin`;
}

module.exports = {
  gardeInProgressExistsSql,
  gardeEffectiveSelectSql,
  gardePlanningSelectSql,
};
