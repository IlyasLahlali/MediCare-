function formatDayLabel(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString("fr-MA", { weekday: "short", day: "numeric" });
}

function setupWelcome(user, statsData) {
  const nameEl = document.getElementById("pharma-greeting-name");
  const leadEl = document.getElementById("pharma-welcome-lead");
  const metaEl = document.getElementById("pharma-welcome-meta");
  const chipsEl = document.getElementById("pharma-welcome-chips");

  if (nameEl) nameEl.textContent = user?.nom || "Tableau de bord";

  const nbPharmacies = statsData?.nb_pharmacies ?? 0;
  const onGarde = statsData?.nb_garde ?? null;

  if (leadEl) {
    if (nbPharmacies === 0) {
      leadEl.textContent =
        "Commencez par ajouter votre première pharmacie pour la faire valider par l'équipe MediCare+.";
    } else {
      leadEl.textContent =
        "Suivez l'activité de vos établissements : gardes, statistiques et performances.";
    }
  }

  if (chipsEl) {
    const chips = [];
    if (nbPharmacies > 0) {
      chips.push(
        `<span class="pharma-welcome__chip">${nbPharmacies} pharmacie${nbPharmacies > 1 ? "s" : ""}</span>`
      );
    }
    if (onGarde != null && onGarde > 0) {
      chips.push(`<span class="pharma-welcome__chip pharma-welcome__chip--garde">${onGarde} en garde</span>`);
    }
    if (statsData?.trafic_total > 0) {
      chips.push(
        `<span class="pharma-welcome__chip">${statsData.trafic_total} interactions</span>`
      );
    }
    if (chips.length) {
      chipsEl.innerHTML = chips.join("");
      chipsEl.hidden = false;
    } else {
      chipsEl.hidden = true;
    }
  }

  if (metaEl) {
    const dateStr = new Date().toLocaleDateString("fr-MA", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    metaEl.textContent = `${dateStr.charAt(0).toUpperCase()}${dateStr.slice(1)}`;
  }
}

function renderStats(data) {
  const t = data.totaux;
  document.getElementById("stat-period").textContent = data.periode_jours;
  document.getElementById("stats-cards").innerHTML = `
    <div class="stat-card">
      <span class="stat-card__icon" aria-hidden="true">👁</span>
      <div class="stat-value">${t.VUE}</div>
      <div class="stat-label">Vues de fiche</div>
    </div>
    <div class="stat-card accent-orange">
      <span class="stat-card__icon" aria-hidden="true">📞</span>
      <div class="stat-value">${t.APPEL}</div>
      <div class="stat-label">Appels</div>
    </div>
    <div class="stat-card accent-blue">
      <span class="stat-card__icon" aria-hidden="true">💊</span>
      <div class="stat-value">${t.RECHERCHE}</div>
      <div class="stat-label">Recherches médicament</div>
    </div>
    <div class="stat-card accent-violet">
      <span class="stat-card__icon" aria-hidden="true">📈</span>
      <div class="stat-value">${data.trafic_total}</div>
      <div class="stat-label">Trafic total</div>
    </div>
    <div class="stat-card">
      <span class="stat-card__icon" aria-hidden="true">🏪</span>
      <div class="stat-value">${data.nb_pharmacies}</div>
      <div class="stat-label">Pharmacies</div>
    </div>`;

  const chart = document.getElementById("traffic-chart");
  const daily = data.trafic_quotidien || [];
  if (!daily.length) {
    chart.innerHTML =
      '<p class="muted">Pas encore de données — le trafic apparaîtra avec l\'usage public.</p>';
    return;
  }
  const max = Math.max(...daily.map((d) => d.total), 1);
  chart.innerHTML = daily
    .map(
      (d) => `
    <div class="traffic-bar-wrap" title="${d.total} interactions">
      <div class="traffic-bar" style="height:${Math.max(8, (d.total / max) * 120)}px"></div>
      <span class="traffic-bar-label">${formatDayLabel(d.jour)}</span>
    </div>`
    )
    .join("");

  const tableEl = document.getElementById("pharma-stats-table");
  if (!data.par_pharmacie?.length) {
    tableEl.innerHTML = '<p class="muted">Aucune pharmacie.</p>';
    return;
  }
  tableEl.innerHTML = `
    <table class="pharma-table">
      <thead>
        <tr><th>Pharmacie</th><th>Vues</th><th>Appels</th><th>Recherches</th></tr>
      </thead>
      <tbody>
        ${data.par_pharmacie
          .map(
            (p) => `
          <tr>
            <td><a href="pharmacieDetail.html?id=${p.id}">${escapeHtml(p.nom)}</a></td>
            <td>${p.vues}</td>
            <td>${p.appels}</td>
            <td>${p.recherches}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

async function loadGardeSummary() {
  const el = document.getElementById("garde-summary-list");
  if (!el) return;
  try {
    const [pharmacies, gardeList] = await Promise.all([
      MediCareAPI.getPharmaPharmacies(),
      MediCareAPI.getGardeSummary(),
    ]);
    if (!pharmacies.length) {
      el.innerHTML =
        '<p class="muted">Aucune pharmacie. <a href="ajouterPharmacie.html">Ajouter une pharmacie</a></p>';
      return 0;
    }

    const onGarde = pharmacies.filter((p) => !!p.est_de_garde);
    if (!onGarde.length) {
      el.className = "";
      el.innerHTML =
        '<p class="muted">Aucune pharmacie en garde pour le moment. <a href="pharmacie.html">Gérer vos pharmacies</a> pour activer une garde.</p>';
      return 0;
    }

    const planningById = Object.fromEntries(gardeList.map((g) => [g.id, g.planning]));
    el.className = "pharmacy-list";
    el.innerHTML = onGarde
      .map((p) => {
        const withPlanning = { ...p, planning: planningById[p.id] || null };
        return renderPharmacyCard(withPlanning, {
          relativeUrl: true,
          badgesExtra: pharmaPendingBadgeHtml(withPlanning),
          metaExtra: pharmaGardePlanningMeta(withPlanning),
          actionsHtml: pharmaGardeCardActions(withPlanning),
        });
      })
      .join("");

    el.querySelectorAll("[data-garde-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        GardePharma.openForPharmacy(btn.dataset.gardeId, btn.dataset.gardeNom, {
          onSuccess: refreshWelcomeMeta,
        });
      });
    });
    return onGarde.length;
  } catch (err) {
    el.innerHTML = `<p class="error">${err.message}</p>`;
    return 0;
  }
}

let cachedStatsData = null;
let cachedUser = null;

async function refreshWelcomeMeta() {
  if (!cachedUser) return;
  const nbGarde = await loadGardeSummary();
  setupWelcome(cachedUser, { ...(cachedStatsData || {}), nb_garde: nbGarde });
}

document.addEventListener("DOMContentLoaded", async () => {
  cachedUser = initPharmaPage();
  if (!cachedUser) return;
  setupModalClose();
  GardePharma.ensureModal();

  try {
    cachedStatsData = await MediCareAPI.getPharmaDashboard(7);
    renderStats(cachedStatsData);
    if (cachedStatsData.warning) {
      const warn = document.createElement("p");
      warn.className = "muted";
      warn.style.marginTop = "0.75rem";
      warn.textContent = `${cachedStatsData.warning} (npm run migrate:stats dans backend)`;
      document.getElementById("stats-cards").after(warn);
    }
  } catch (err) {
    document.getElementById("stats-cards").innerHTML = `<p class="error">${err.message}</p>`;
    document.getElementById("traffic-chart").innerHTML =
      '<p class="muted">Impossible de charger le graphique.</p>';
    document.getElementById("pharma-stats-table").innerHTML = "";
  }

  await refreshWelcomeMeta();
});
