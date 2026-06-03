const PREVIEW_LIMIT = 6;

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

window.scrollToSection = scrollToSection;

function setWelcome(user) {
  const el = document.getElementById("welcomeText");
  if (el && user?.nom) el.textContent = `Bonjour ${user.nom}`;
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
  } catch (err) {
    console.error(err);
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

function refreshAdmin() {
  loadAdminStats();
  loadPreviewAttente();
  loadPreviewRecent();
}

window.refreshAdmin = refreshAdmin;

document.addEventListener("DOMContentLoaded", () => {
  const user = initAdminPage();
  if (!user) return;
  setWelcome(user);
  refreshAdmin();
});
