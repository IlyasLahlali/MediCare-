const dashboardState = {
  period: 7,
  user: null,
  stats: null,
  pharmacies: [],
  nbGarde: 0,
};

function formatDayLabel(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString("fr-MA", { weekday: "short", day: "numeric" });
}

function toLocalDateKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTodayMeta() {
  const dateStr = new Date().toLocaleDateString("fr-MA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}

function greetingSaluteForHour(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 18) return "Bonjour";
  return "Bonsoir";
}

function computePharmacyOverview(pharmacies) {
  const o = {
    total: pharmacies.length,
    valide: 0,
    en_attente: 0,
    refuse: 0,
    garde: 0,
    manualClose: 0,
    openNow: 0,
  };
  for (const p of pharmacies) {
    const st = typeof pharmaValidationStatut === "function" ? pharmaValidationStatut(p) : "";
    if (st === "valide") o.valide++;
    else if (st === "refuse") o.refuse++;
    else o.en_attente++;
    if (p.est_de_garde) o.garde++;
    if (p.fermeture_manuelle) o.manualClose++;
    if (typeof pharmacyIsEffectivelyOpen === "function" && pharmacyIsEffectivelyOpen(p)) {
      o.openNow++;
    }
  }
  return o;
}

function overviewTile(href, value, label, mod = "", icon = "•") {
  return `<a href="${href}" class="pd-overview-tile ${mod}">
    <span class="pd-overview-tile__icon" aria-hidden="true">${icon}</span>
    <span class="pd-overview-tile__value">${value}</span>
    <span class="pd-overview-tile__label">${escapeHtml(label)}</span>
  </a>`;
}

function renderInsights(overview, stats) {
  const el = document.getElementById("pd-insights");
  const bar = el?.closest(".pd-insights-bar");
  if (!el) return;

  const items = [];

  if (!overview.total) {
    items.push({
      mod: "pd-insight--cta",
      icon: "🏥",
      title: "Commencez ici",
      text: "Ajoutez votre première pharmacie pour la soumettre à validation.",
      href: "ajouterPharmacie.html",
      link: "Ajouter une pharmacie →",
    });
  } else if (overview.en_attente > 0) {
    items.push({
      mod: "pd-insight--warn",
      icon: "⏳",
      title: `${overview.en_attente} en attente`,
      text: "Validation MediCare+ en cours — vérifiez les informations de la fiche.",
      href: "pharmacie.html?statut=en_attente",
      link: "Voir les demandes →",
    });
  }

  if (overview.manualClose > 0) {
    items.push({
      mod: "pd-insight--alert",
      icon: "⏸",
      title: "Fermeture manuelle",
      text: `${overview.manualClose} pharmacie${overview.manualClose > 1 ? "s" : ""} fermée${overview.manualClose > 1 ? "s" : ""} manuellement aujourd’hui.`,
      href: "pharmacie.html",
      link: "Gérer →",
    });
  }

  if (overview.total > 0 && overview.garde === 0 && overview.valide > 0) {
    items.push({
      mod: "pd-insight--info",
      icon: "🌙",
      title: "Aucune garde active",
      text: "Activez le mode garde depuis la fiche d’une pharmacie validée.",
      href: "pharmacie.html",
      link: "Mes pharmacies →",
    });
  }

  if (overview.total > 0 && stats && stats.trafic_total === 0 && !stats.warning) {
    items.push({
      mod: "pd-insight--info",
      icon: "📈",
      title: "Visibilité en cours",
      text: "Le trafic patient apparaîtra dès que vos fiches seront consultées sur MediCare+.",
      href: null,
      link: null,
    });
  }

  if (!items.length) {
    el.innerHTML = "";
    bar?.classList.add("is-empty");
    return;
  }

  bar?.classList.remove("is-empty");
  el.innerHTML = items
    .map(
      (it) => `
    <article class="pd-insight ${it.mod}">
      <span class="pd-insight__icon" aria-hidden="true">${it.icon}</span>
      <div class="pd-insight__body">
        <h3 class="pd-insight__title">${escapeHtml(it.title)}</h3>
        <p class="pd-insight__text">${escapeHtml(it.text)}</p>
        ${it.link && it.href ? `<a href="${it.href}" class="pd-insight__link">${escapeHtml(it.link)}</a>` : ""}
      </div>
    </article>`
    )
    .join("");
}

function renderHeroStat(stats) {
  const wrap = document.getElementById("pharma-hero-stat");
  const valEl = document.getElementById("pharma-hero-stat-value");
  const labelEl = document.getElementById("pharma-hero-stat-label");
  if (!wrap || !stats || stats.trafic_total <= 0) {
    if (wrap) wrap.hidden = true;
    return;
  }
  if (valEl) valEl.textContent = stats.trafic_total;
  if (labelEl) {
    labelEl.textContent = `interaction${stats.trafic_total > 1 ? "s" : ""} (${stats.periode_jours} j)`;
  }
  wrap.hidden = false;
}

function updateGardeBadge(count) {
  const badge = document.getElementById("pd-garde-badge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = String(count);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function updateStatsSubtitle(days) {
  const el = document.getElementById("pd-stats-subtitle");
  if (el) el.textContent = `Interactions patients sur les ${days} derniers jours.`;
}

function setupWelcome(user, statsData, overview) {
  const saluteEl = document.getElementById("pharma-greeting-salute");
  const nameEl = document.getElementById("pharma-greeting-name");
  const leadEl = document.getElementById("pharma-welcome-lead");
  const metaEl = document.getElementById("pharma-welcome-meta");
  const chipsEl = document.getElementById("pharma-welcome-chips");

  const salute = greetingSaluteForHour();
  if (saluteEl) {
    saluteEl.textContent = salute;
    saluteEl.setAttribute("aria-hidden", "true");
  }
  if (nameEl) {
    const name = user?.nom || "Pharmacien";
    nameEl.textContent = name;
    const titleRoot = document.getElementById("pd-hero-title");
    if (titleRoot) titleRoot.setAttribute("aria-label", `${salute}, ${name}`);
  }

  const nbPharmacies = overview?.total ?? statsData?.nb_pharmacies ?? 0;
  const onGarde = dashboardState.nbGarde;

  if (leadEl) {
    if (nbPharmacies === 0) {
      leadEl.textContent =
        "Ajoutez votre première pharmacie pour la faire valider et apparaître sur MediCare+.";
    } else if (overview?.en_attente > 0) {
      leadEl.textContent = `${overview.en_attente} établissement${overview.en_attente > 1 ? "s" : ""} en attente — consultez vos statistiques et gardes ci-dessous.`;
    } else if (statsData?.trafic_total > 0) {
      leadEl.textContent = `${statsData.trafic_total} interaction${statsData.trafic_total > 1 ? "s" : ""} sur les ${statsData.periode_jours} derniers jours : vos fiches génèrent de l’activité.`;
    } else {
      leadEl.textContent =
        "Suivez vos gardes, la visibilité de vos fiches et l’engagement des patients en temps réel.";
    }
  }

  if (chipsEl) {
    const chips = [];
    if (nbPharmacies > 0) {
      chips.push(
        `<span class="pd-hero__chip">${nbPharmacies} pharmacie${nbPharmacies > 1 ? "s" : ""}</span>`
      );
    }
    if (overview?.openNow > 0) {
      chips.push(
        `<span class="pd-hero__chip">${overview.openNow} ouverte${overview.openNow > 1 ? "s" : ""}</span>`
      );
    }
    if (onGarde > 0) {
      chips.push(`<span class="pd-hero__chip pd-hero__chip--garde">${onGarde} en garde</span>`);
    }
    if (overview?.manualClose > 0) {
      chips.push(
        `<span class="pd-hero__chip pd-hero__chip--warn">${overview.manualClose} fermée${overview.manualClose > 1 ? "s" : ""} manuellement</span>`
      );
    }
    if (chips.length) {
      chipsEl.innerHTML = chips.join("");
      chipsEl.hidden = false;
    } else {
      chipsEl.hidden = true;
    }
  }

  if (metaEl) metaEl.textContent = formatTodayMeta();
  renderHeroStat(statsData);
  renderInsights(overview, statsData);
}

function renderRecentPharmacies(pharmacies) {
  const el = document.getElementById("pd-recent-pharmacies");
  if (!el || pharmacies.length < 2) {
    if (el) el.hidden = true;
    return;
  }

  const sorted = [...pharmacies].sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));
  const slice = sorted.slice(0, 4);

  el.hidden = false;
  el.innerHTML = `
    <h3 class="pd-recent__title">Accès rapide</h3>
    <ul class="pd-recent__list">
      ${slice
        .map((p) => {
          const pill =
            typeof pharmaStatusPill === "function" ? pharmaStatusPill(p) : "";
          return `<li>
            <a href="pharmacieDetail.html?id=${p.id}" class="pd-recent__link">
              <span class="pd-recent__name">${escapeHtml(p.nom)}</span>
              ${pill ? `<span class="pd-recent__pill-wrap">${pill}</span>` : ""}
            </a>
          </li>`;
        })
        .join("")}
    </ul>`;
}

function renderPharmacyOverview(pharmacies) {
  const el = document.getElementById("pharmacy-overview");
  if (!el) return;

  if (!pharmacies.length) {
    el.innerHTML = `
      <div class="pd-empty pd-empty--inline">
        <div class="pd-empty__icon" aria-hidden="true">🏥</div>
        <p>Aucune pharmacie enregistrée.</p>
        <a href="ajouterPharmacie.html" class="btn btn-teal">Ajouter une pharmacie</a>
      </div>`;
    renderRecentPharmacies([]);
    return;
  }

  const o = computePharmacyOverview(pharmacies);
  el.innerHTML = `
    ${overviewTile("pharmacie.html", o.total, "Total", "pd-overview-tile--accent", "🏪")}
    ${overviewTile("pharmacie.html?statut=valide", o.valide, "Validées", "pd-overview-tile--accent", "✓")}
    ${overviewTile("pharmacie.html?statut=en_attente", o.en_attente, "En attente", "pd-overview-tile--warn", "⏳")}
    ${overviewTile("pharmacie.html", o.openNow, "Ouvertes", "", "🟢")}
    ${overviewTile("pharmacie.html", o.garde, "De garde", "pd-overview-tile--warn", "🌙")}
    ${
      o.manualClose > 0
        ? overviewTile("pharmacie.html", o.manualClose, "Fermées manuellement", "pd-overview-tile--muted", "⏸")
        : overviewTile("pharmacie.html?statut=refuse", o.refuse, "Refusées", "pd-overview-tile--muted", "✕")
    }`;

  renderRecentPharmacies(pharmacies);
}

function kpiPercent(part, total) {
  if (!total || part <= 0) return "";
  const pct = Math.round((part / total) * 100);
  return `<span class="pd-kpi__share">${pct}% du trafic</span>`;
}

function renderKpis(data) {
  const el = document.getElementById("stats-cards");
  if (!el) return;
  const t = data.totaux;
  const total = data.trafic_total || 0;

  el.innerHTML = `
    <article class="pd-kpi">
      <span class="pd-kpi__icon" aria-hidden="true">👁</span>
      <div class="pd-kpi__value">${t.VUE}</div>
      <div class="pd-kpi__label">Vues de fiche</div>
      ${kpiPercent(t.VUE, total)}
    </article>
    <article class="pd-kpi pd-kpi--red">
      <span class="pd-kpi__icon" aria-hidden="true">📞</span>
      <div class="pd-kpi__value">${t.APPEL}</div>
      <div class="pd-kpi__label">Appels</div>
      ${kpiPercent(t.APPEL, total)}
    </article>
    <article class="pd-kpi pd-kpi--blue">
      <span class="pd-kpi__icon" aria-hidden="true">💊</span>
      <div class="pd-kpi__value">${t.RECHERCHE}</div>
      <div class="pd-kpi__label">Recherches</div>
      ${kpiPercent(t.RECHERCHE, total)}
    </article>
    <article class="pd-kpi pd-kpi--violet pd-kpi--featured">
      <span class="pd-kpi__icon" aria-hidden="true">📈</span>
      <div class="pd-kpi__value">${total}</div>
      <div class="pd-kpi__label">Trafic total</div>
      <span class="pd-kpi__share">sur ${data.periode_jours} jours</span>
    </article>
    <article class="pd-kpi">
      <span class="pd-kpi__icon" aria-hidden="true">🏪</span>
      <div class="pd-kpi__value">${data.nb_pharmacies}</div>
      <div class="pd-kpi__label">Pharmacies</div>
    </article>`;
}

function renderTrafficChart(data) {
  const chart = document.getElementById("traffic-chart");
  const legend = document.getElementById("traffic-chart-legend");
  const summary = document.getElementById("traffic-chart-summary");
  if (!chart) return;

  const daily = data.trafic_quotidien || [];
  const t = data.totaux;

  if (summary) {
    if (daily.length) {
      summary.classList.remove("hidden");
      summary.innerHTML = `
        <span class="pd-chart-summary__item"><strong>${t.VUE}</strong> vues</span>
        <span class="pd-chart-summary__item pd-chart-summary__item--appel"><strong>${t.APPEL}</strong> appels</span>
        <span class="pd-chart-summary__item"><strong>${t.RECHERCHE}</strong> recherches</span>`;
    } else {
      summary.classList.add("hidden");
    }
  }

  if (!daily.length) {
    if (legend) legend.classList.add("hidden");
    chart.innerHTML =
      '<p class="pd-chart-empty">Pas encore de données — le trafic apparaîtra avec l’usage public.</p>';
    return;
  }

  const max = Math.max(...daily.map((d) => d.total), 1);
  const chartHeight = 128;
  const todayKey = toLocalDateKey(new Date());

  if (legend) {
    legend.classList.remove("hidden");
    legend.innerHTML = `
      <span class="pd-chart-legend__item"><span class="pd-chart-legend__dot pd-chart-legend__dot--vue"></span>Vues</span>
      <span class="pd-chart-legend__item"><span class="pd-chart-legend__dot pd-chart-legend__dot--appel"></span>Appels</span>
      <span class="pd-chart-legend__item"><span class="pd-chart-legend__dot pd-chart-legend__dot--recherche"></span>Recherches</span>`;
  }

  chart.innerHTML = daily
    .map((d) => {
      const dayKey = toLocalDateKey(d.jour);
      const isToday = dayKey && dayKey === todayKey;
      const stackH = Math.max(8, (d.total / max) * chartHeight);
      const vueH = d.total ? (d.vues / d.total) * stackH : 0;
      const appelH = d.total ? (d.appels / d.total) * stackH : 0;
      const rechH = d.total ? (d.recherches / d.total) * stackH : 0;
      return `
    <div class="pd-chart__col${isToday ? " pd-chart__col--today" : ""}" title="${d.total} interactions">
      <div class="pd-chart__stack" style="--pd-stack-h:${stackH}px">
        ${vueH > 0 ? `<div class="pd-chart__seg pd-chart__seg--vue" style="height:${vueH}px"></div>` : ""}
        ${appelH > 0 ? `<div class="pd-chart__seg pd-chart__seg--appel" style="height:${appelH}px"></div>` : ""}
        ${rechH > 0 ? `<div class="pd-chart__seg pd-chart__seg--recherche" style="height:${rechH}px"></div>` : ""}
      </div>
      <span class="pd-chart__label">${formatDayLabel(d.jour)}${isToday ? " ·" : ""}</span>
      <span class="pd-chart__tooltip">${d.total}</span>
    </div>`;
    })
    .join("");

  requestAnimationFrame(() => {
    chart.querySelectorAll(".pd-chart__stack").forEach((node) => node.classList.add("is-ready"));
  });
}

function renderPerformance(data) {
  const tableEl = document.getElementById("pharma-stats-table");
  if (!tableEl) return;

  const list = [...(data.par_pharmacie || [])].sort(
    (a, b) => b.vues + b.appels + b.recherches - (a.vues + a.appels + a.recherches)
  );

  if (!list.length) {
    tableEl.innerHTML = '<p class="pd-chart-empty">Aucune pharmacie enregistrée.</p>';
    return;
  }

  const maxTotal = Math.max(
    ...list.map((p) => p.vues + p.appels + p.recherches),
    1
  );

  tableEl.innerHTML = `
    <ol class="pd-perf-list">
      ${list
        .map((p, i) => {
          const total = p.vues + p.appels + p.recherches;
          const pct = Math.round((total / maxTotal) * 100);
          const rank = i + 1;
          const rankClass =
            rank === 1 ? "pd-perf-item--gold" : rank === 2 ? "pd-perf-item--silver" : rank === 3 ? "pd-perf-item--bronze" : "";
          return `
        <li class="pd-perf-item ${rankClass}">
          <div class="pd-perf-item__top">
            <span class="pd-perf-item__rank" aria-label="Rang ${rank}">${rank}</span>
            <a href="pharmacieDetail.html?id=${p.id}" class="pd-perf-item__name">${escapeHtml(p.nom)}</a>
            <span class="pd-perf-item__total">${total}</span>
          </div>
          <div class="pd-perf-bar" role="presentation">
            <div class="pd-perf-bar__fill" style="width:${pct}%"></div>
          </div>
          <div class="pd-perf-breakdown">
            <span class="pd-perf-tag pd-perf-tag--vue"><strong>${p.vues}</strong> vues</span>
            <span class="pd-perf-tag pd-perf-tag--appel"><strong>${p.appels}</strong> appels</span>
            <span class="pd-perf-tag pd-perf-tag--rech"><strong>${p.recherches}</strong> rech.</span>
          </div>
        </li>`;
        })
        .join("")}
    </ol>`;
}

function renderStats(data) {
  renderKpis(data);
  renderTrafficChart(data);
  renderPerformance(data);
  renderHeroStat(data);

  const warnEl = document.getElementById("stats-warning");
  if (warnEl) {
    if (data.warning) {
      warnEl.textContent = `${data.warning} (npm run migrate:stats dans backend)`;
      warnEl.classList.remove("hidden");
    } else {
      warnEl.classList.add("hidden");
      warnEl.textContent = "";
    }
  }

  const overview = computePharmacyOverview(dashboardState.pharmacies);
  renderInsights(overview, data);
}

function renderGardeEmpty(hasPharmacies) {
  if (!hasPharmacies) {
    return `
      <div class="pd-empty">
        <div class="pd-empty__icon" aria-hidden="true">🏥</div>
        <p>Commencez par ajouter une pharmacie.</p>
        <a href="ajouterPharmacie.html" class="btn btn-teal">Ajouter une pharmacie</a>
      </div>`;
  }
  return `
    <div class="pd-empty">
      <div class="pd-empty__icon" aria-hidden="true">🌙</div>
      <p>Aucune pharmacie en garde pour le moment.</p>
      <a href="pharmacie.html" class="btn btn-outline">Gérer mes pharmacies</a>
    </div>`;
}

async function loadGardeSummary() {
  const el = document.getElementById("garde-summary-list");
  if (!el) return 0;

  try {
    const pharmacies = dashboardState.pharmacies.length
      ? dashboardState.pharmacies
      : await MediCareAPI.getPharmaPharmacies();
    if (!dashboardState.pharmacies.length) dashboardState.pharmacies = pharmacies;

    if (!pharmacies.length) {
      el.className = "";
      el.innerHTML = renderGardeEmpty(false);
      updateGardeBadge(0);
      return 0;
    }

    const onGarde = pharmacies.filter((p) => !!p.est_de_garde);
    if (!onGarde.length) {
      el.className = "";
      el.innerHTML = renderGardeEmpty(true);
      updateGardeBadge(0);
      return 0;
    }

    const gardeList = await MediCareAPI.getGardeSummary();
    const planningById = Object.fromEntries(gardeList.map((g) => [g.id, g.planning]));

    el.className = "pharmacy-list pd-garde-list pharma-owner-list";
    el.innerHTML = onGarde
      .map((p) => {
        const withPlanning = { ...p, planning: planningById[p.id] || null };
        return renderPharmacyCard(withPlanning, {
          relativeUrl: true,
          zone: "pharmacien",
          cardClickable: true,
          badgesExtra:
            typeof pharmaValidationBadgeHtml === "function"
              ? pharmaValidationBadgeHtml(withPlanning)
              : "",
          metaExtra:
            (typeof pharmaGardePlanningMeta === "function"
              ? pharmaGardePlanningMeta(withPlanning)
              : "") +
            (typeof pharmaOwnerCardMetaExtra === "function"
              ? pharmaOwnerCardMetaExtra(withPlanning)
              : ""),
          actionsHtml:
            typeof pharmaGardeCardActions === "function"
              ? pharmaGardeCardActions(withPlanning)
              : "",
        });
      })
      .join("");

    bindPharmacyCardClicks(el);

    el.querySelectorAll("[data-garde-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        GardePharma.openForPharmacy(btn.dataset.gardeId, btn.dataset.gardeNom, {
          onSuccess: refreshDashboardMeta,
        });
      });
    });

    updateGardeBadge(onGarde.length);
    return onGarde.length;
  } catch (err) {
    el.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    updateGardeBadge(0);
    return 0;
  }
}

async function loadStats() {
  const section = document.getElementById("pd-analytics");
  const cards = document.getElementById("stats-cards");
  const chart = document.getElementById("traffic-chart");
  const perf = document.getElementById("pharma-stats-table");

  section?.classList.add("is-loading");
  if (cards) cards.innerHTML = '<p class="pd-loading">Chargement…</p>';
  if (chart) chart.innerHTML = "";
  if (perf) perf.innerHTML = '<p class="pd-loading">Chargement…</p>';

  try {
    dashboardState.stats = await MediCareAPI.getPharmaDashboard(dashboardState.period);
    renderStats(dashboardState.stats);
    const overview = computePharmacyOverview(dashboardState.pharmacies);
    setupWelcome(dashboardState.user, dashboardState.stats, overview);
  } catch (err) {
    if (cards) cards.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    if (chart) chart.innerHTML = '<p class="pd-chart-empty">Impossible de charger le graphique.</p>';
    if (perf) perf.innerHTML = "";
  } finally {
    section?.classList.remove("is-loading");
  }
}

async function refreshDashboardMeta() {
  if (!dashboardState.user) return;
  try {
    dashboardState.pharmacies = await MediCareAPI.getPharmaPharmacies();
  } catch {
    /* ignore */
  }
  renderPharmacyOverview(dashboardState.pharmacies);
  dashboardState.nbGarde = await loadGardeSummary();
  const overview = computePharmacyOverview(dashboardState.pharmacies);
  setupWelcome(dashboardState.user, dashboardState.stats, overview);
}

function setPeriod(days) {
  dashboardState.period = days;
  document.querySelectorAll(".pd-period__btn").forEach((btn) => {
    btn.classList.toggle("is-active", Number(btn.dataset.period) === days);
  });
  updateStatsSubtitle(days);
  loadStats();
}

document.addEventListener("DOMContentLoaded", async () => {
  dashboardState.user = initPharmaPage();
  if (!dashboardState.user) return;
  setupModalClose();
  GardePharma.ensureModal();
  updateStatsSubtitle(dashboardState.period);

  document.querySelectorAll(".pd-period__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const days = Number(btn.dataset.period);
      if (days && days !== dashboardState.period) setPeriod(days);
    });
  });

  try {
    dashboardState.pharmacies = await MediCareAPI.getPharmaPharmacies();
    renderPharmacyOverview(dashboardState.pharmacies);
  } catch (err) {
    const el = document.getElementById("pharmacy-overview");
    if (el) el.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }

  await Promise.all([loadStats(), refreshDashboardMeta()]);
});
