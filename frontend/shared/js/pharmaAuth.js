function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

function requirePharmacien() {
  const token = localStorage.getItem("token");
  const user = getStoredUser();
  if (!token || !user || user.role !== "PHARMACIEN") {
    window.location.href = pageUrl("Pharmacien/html/login.html");
    return null;
  }
  return user;
}

function logoutPharmacien() {
  if (window.NotificationCenter) NotificationCenter.stopPolling();
  clearSession();
  window.location.href = pageUrl("Public/html/index.html");
}

function bindPharmaHeader(user) {
  const el = document.getElementById("pharma-name");
  if (el && user) el.textContent = user.nom;
  if (window.UserAccountMenu) UserAccountMenu.init();
}

function initPharmaPage() {
  const user = requirePharmacien();
  if (!user) return null;
  bindPharmaHeader(user);
  document.getElementById("btn-logout")?.addEventListener("click", logoutPharmacien);
  if (window.NotificationCenter) {
    NotificationCenter.init("#notif-center-mount");
  }
  return user;
}

function pharmaStatusPill(p) {
  if (!p.est_active) return '<span class="status-pill status-pending">En attente</span>';
  if (p.est_de_garde) return '<span class="status-pill" style="background:#fef3c7;color:#b45309">De garde</span>';
  if (p.est_ouverte) return '<span class="status-pill status-active">Ouverte</span>';
  return '<span class="status-pill status-closed">Fermée</span>';
}

function pharmaValidationStatut(p) {
  if (p.statut === "valide" || p.statut === "refuse" || p.statut === "en_attente") {
    return p.statut;
  }
  return p.est_active ? "valide" : "en_attente";
}

function pharmaValidationBadgeHtml(p) {
  const statut = pharmaValidationStatut(p);
  if (statut === "valide") return '<span class="badge badge-valide">Validée</span> ';
  if (statut === "refuse") return '<span class="badge badge-refuse">Refusée</span> ';
  return '<span class="badge badge-pending">En attente</span> ';
}

/** @deprecated utilise pharmaValidationBadgeHtml */
function pharmaPendingBadgeHtml(p) {
  return pharmaValidationBadgeHtml(p);
}

function pharmaCanManageGarde(p) {
  const statut = pharmaValidationStatut(p);
  return statut === "valide" || statut === "en_attente";
}

function pharmaPharmacyCardActions(p) {
  const gardeBtn = pharmaCanManageGarde(p)
    ? `<button type="button" class="btn btn-small btn-garde" data-garde-id="${p.id}" data-garde-nom="${escapeHtml(p.nom)}">Garde</button>`
    : "";
  return `
    ${gardeBtn}
    <a href="pharmacieDetail.html?id=${p.id}" class="btn btn-teal btn-small">Voir détail</a>`;
}

function pharmaRechercheCardActions(p) {
  return `
    <a href="pharmacieDetail.html?id=${p.id}" class="btn btn-teal btn-small">Détail</a>
    <button type="button" class="btn btn-outline btn-small" data-edit-pharmacy="${p.id}">Modifier</button>
    <button type="button" class="btn btn-outline btn-small" data-delete-pharmacy="${p.id}" data-name="${escapeHtml(p.nom)}">Supprimer</button>`;
}

function pharmaGardeCardActions(p) {
  return `
    <button type="button" class="btn btn-small btn-garde" data-garde-id="${p.id}" data-garde-nom="${escapeHtml(p.nom)}">Gérer la garde</button>
    <a href="pharmacieDetail.html?id=${p.id}" class="btn btn-outline btn-small">Détail</a>`;
}

function pharmaGardePlanningMeta(p) {
  if (!p.planning?.date_fin) return "";
  const fin = formatPharmacyDateTimeLabel(p.planning.date_fin);
  return `<p class="muted pharmacy-card-meta pharmacy-garde-hours">Garde active${fin ? ` jusqu’au ${escapeHtml(fin)}` : ""}</p>`;
}

function openPharmaModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

function closePharmaModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

function setupModalClose() {
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closePharmaModal(btn.dataset.closeModal));
  });
  document.querySelectorAll(".pharma-modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closePharmaModal(modal.id);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".pharma-modal:not(.hidden)").forEach((m) => {
        closePharmaModal(m.id);
      });
    }
  });
}

function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text ?? "";
  return d.innerHTML;
}

async function resizePharmacyImageFile(file) {
  const maxW = 1200;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxW) {
        h = (h * maxW) / w;
        w = maxW;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
