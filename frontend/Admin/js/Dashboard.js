const PREVIEW_LIMIT = 6;
let dashboardAdminUser = null;

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

window.scrollToSection = scrollToSection;

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

function setupAdminWelcome(user, stats) {
  const saluteEl = document.getElementById("admin-greeting-salute");
  const nameEl = document.getElementById("admin-greeting-name");
  const leadEl = document.getElementById("admin-welcome-lead");
  const metaEl = document.getElementById("admin-welcome-meta");

  const salute = greetingSaluteForHour();
  const name = user?.nom || "Administrateur";
  const attente = Number(stats?.pharmaciesEnAttente) || 0;
  const total = Number(stats?.totalPharmacies) || 0;

  if (saluteEl) {
    saluteEl.textContent = salute;
    saluteEl.setAttribute("aria-hidden", "true");
  }
  if (nameEl) {
    nameEl.textContent = name;
    const titleRoot = document.getElementById("admin-hero-title");
    if (titleRoot) titleRoot.setAttribute("aria-label", `${salute}, ${name}`);
  }

  if (leadEl) {
    if (attente > 0) {
      leadEl.textContent = `${attente} pharmacie${attente > 1 ? "s" : ""} en attente de validation — consultez la liste « À valider » ci-dessous.`;
    } else if (total === 0) {
      leadEl.textContent =
        "Aucune pharmacie inscrite pour le moment. Les nouvelles demandes apparaîtront ici.";
    } else {
      leadEl.textContent =
        "Supervisez les pharmacies, validez les inscriptions et gardez la qualité des données sur MediCare+.";
    }
  }

  if (metaEl) metaEl.textContent = formatTodayMeta();
}

function showFeedback(text, error = false) {
  const el = document.getElementById("adminMessage");
  if (!el) return;
  el.textContent = text;
  el.className = error ? "admin-feedback error" : "admin-feedback success";
}

async function loadAdminStats() {
  try {
    const stats = await MediCareAPI.getAdminStats();
    document.getElementById("statUtilisateurs").textContent = stats.totalUtilisateurs ?? 0;
    document.getElementById("statPharmaciens").textContent = stats.totalPharmaciens ?? 0;
    document.getElementById("statTotalPharmacies").textContent = stats.totalPharmacies ?? 0;
    document.getElementById("statPharmaciesValides").textContent = stats.pharmaciesValides ?? 0;
    document.getElementById("statPharmaciesAttente").textContent = stats.pharmaciesEnAttente ?? 0;
    document.getElementById("statPharmaciesRefusees").textContent = stats.pharmaciesRefusees ?? 0;
    return stats;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function renderPreviewList(pharmacies, listEl, countEl, emptyText, backPath) {
  if (!listEl) return;
  const back = encodeURIComponent(backPath);

  if (countEl) {
    countEl.textContent =
      pharmacies.length === 0 ? emptyText : `${pharmacies.length} affichée(s) sur cette page`;
  }

  if (!pharmacies.length) {
    listEl.innerHTML = `
      <div class="admin-empty">
        <span class="admin-empty-icon">💊</span>
        <p>${emptyText}</p>
      </div>`;
    return;
  }

  listEl.innerHTML = pharmacies
    .map((p) => adminRenderPharmacyRow(p, adminPharmacyDetailUrl(p.id, back)))
    .join("");
}

async function loadPreviewAttente() {
  const list = document.getElementById("attenteList");
  const count = document.getElementById("attenteCount");
  if (!list) return;

  list.innerHTML = '<p class="admin-loading">Chargement…</p>';

  try {
    const pharmacies = await MediCareAPI.getAdminPharmacies("en_attente", PREVIEW_LIMIT);
    renderPreviewList(
      pharmacies,
      list,
      count,
      "Aucune pharmacie en attente de validation.",
      "Dashboard.html"
    );
  } catch (err) {
    list.innerHTML = "";
    showFeedback(err.message, true);
  }
}

async function loadPreviewRecent() {
  const list = document.getElementById("recentList");
  const count = document.getElementById("recentCount");
  if (!list) return;

  list.innerHTML = '<p class="admin-loading">Chargement…</p>';

  try {
    const pharmacies = await MediCareAPI.getAdminPharmacies("", PREVIEW_LIMIT);
    renderPreviewList(
      pharmacies,
      list,
      count,
      "Aucune pharmacie enregistrée.",
      "Dashboard.html"
    );
  } catch (err) {
    list.innerHTML = "";
    showFeedback(err.message, true);
  }
}

async function refreshAdmin() {
  const stats = await loadAdminStats();
  setupAdminWelcome(dashboardAdminUser, stats);
  await loadPreviewAttente();
  await loadPreviewRecent();
}

window.refreshAdmin = refreshAdmin;

document.addEventListener("DOMContentLoaded", () => {
  const user = initAdminPage();
  if (!user) return;
  dashboardAdminUser = user;
  refreshAdmin();
});
