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
  if (user && window.UserAccountMenu) UserAccountMenu.init();
}

function initPharmaPage() {
  const user = requirePharmacien();
  if (!user) return null;
  bindPharmaHeader(user);
  if (window.NotificationCenter) {
    NotificationCenter.init("#notif-center-mount");
  }
  return user;
}

function pharmaStatusPill(p) {
  const validation = pharmaValidationStatut(p);
  if (validation === "en_attente") {
    return '<span class="status-pill status-pending">En attente</span>';
  }
  if (validation === "refuse") {
    return '<span class="status-pill status-closed">Refusée</span>';
  }
  if (p.est_de_garde) return '<span class="status-pill" style="background:#fef3c7;color:#b45309">De garde</span>';
  const open =
    typeof pharmacyIsEffectivelyOpen === "function"
      ? pharmacyIsEffectivelyOpen(p)
      : !!Number(p.est_ouverte);
  if (open) return '<span class="status-pill status-active">Ouverte</span>';
  return '<span class="status-pill status-closed">Fermée</span>';
}

function pharmaValidationStatut(p) {
  if (p.statut === "valide" || p.statut === "refuse" || p.statut === "en_attente") {
    return p.statut;
  }
  if (p.statut_admin === "valide" || p.statut_admin === "refuse" || p.statut_admin === "en_attente") {
    return p.statut_admin;
  }
  return "en_attente";
}

function pharmaIsPublished(p) {
  return pharmaValidationStatut(p) === "valide";
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

function pharmaOwnerCardMetaExtra(p) {
  const parts = [];
  if (p.fermeture_manuelle) {
    parts.push(
      '<p class="pharmacy-card-meta pharmacy-card-meta--manual"><span class="pharmacy-card-meta-icon" aria-hidden="true">⏸</span>Fermée manuellement aujourd’hui</p>'
    );
  }
  return parts.join("");
}

function pharmaPharmacyCardActions(p) {
  const gardeBtn = pharmaCanManageGarde(p)
    ? `<button type="button" class="btn btn-small btn-garde pharmacy-card-btn" data-garde-id="${p.id}" data-garde-nom="${escapeHtml(p.nom)}">${p.est_de_garde ? "Gérer la garde" : "Mode de garde"}</button>`
    : "";
  return `
    <a href="pharmacieDetail.html?id=${p.id}" class="btn btn-teal btn-small pharmacy-card-detail-btn">Ouvrir la fiche</a>
    ${gardeBtn ? `<div class="pharmacy-card-actions__btns">${gardeBtn}</div>` : ""}`;
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

function syncPharmaModalBodyState() {
  const hasOpen = !!document.querySelector(".pharma-modal:not(.hidden)");
  document.body.classList.toggle("pharma-modal-open", hasOpen);
}

function openPharmaModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("hidden");
  syncPharmaModalBodyState();
}

function closePharmaModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("hidden");
  syncPharmaModalBodyState();
}

function setupModalClose() {
  if (setupModalClose._bound) return;
  setupModalClose._bound = true;

  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("[data-close-modal]");
    if (closeBtn?.dataset?.closeModal) {
      e.preventDefault();
      closePharmaModal(closeBtn.dataset.closeModal);
      return;
    }
    const modal = e.target.closest(".pharma-modal");
    if (modal && !modal.classList.contains("hidden") && e.target === modal) {
      closePharmaModal(modal.id);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".pharma-modal:not(.hidden)").forEach((m) => {
      closePharmaModal(m.id);
    });
  });
}

function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text ?? "";
  return d.innerHTML;
}

const PHARMA_PHOTO_UPLOAD_ICONS = {
  camera: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  upload: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
};

function pharmaPhotoUploadHtml({ idPrefix = "image", imgUrl = "", title = "", compact = false }) {
  const hasImage = !!imgUrl;
  const safeTitle = escapeHtml(title || "la pharmacie");
  const safeUrl = hasImage ? escapeHtml(imgUrl) : "";
  const compactClass = compact ? " pharma-photo-upload--compact" : "";
  const emptyTitle = compact ? "Photo" : "Ajoutez une photo";
  const emptyHint = compact
    ? "Glisser-déposer ou bouton"
    : "Glissez-déposez une image ici ou utilisez le bouton ci-dessous";
  return `
    <div class="pharma-photo-upload${compactClass}${hasImage ? " has-image" : ""}" id="${idPrefix}-dropzone" data-pharma-photo-upload>
      <div class="pharma-photo-upload__frame" data-photo-frame>
        <img
          id="${idPrefix}-preview"
          class="pharma-photo-upload__preview js-pharmacy-photo-preview${hasImage ? "" : " hidden"}"
          src="${safeUrl}"
          alt=""
          data-pharmacy-photo-title="${safeTitle}"
          ${hasImage ? 'role="button" tabindex="0" aria-label="Voir la photo en grand"' : ""}
        />
        <div id="${idPrefix}-placeholder" class="pharma-photo-upload__empty${hasImage ? " hidden" : ""}">
          <div class="pharma-photo-upload__ring">${PHARMA_PHOTO_UPLOAD_ICONS.camera}</div>
          <p class="pharma-photo-upload__empty-title">${emptyTitle}</p>
          <p class="pharma-photo-upload__empty-hint">${emptyHint}</p>
          <div class="pharma-photo-upload__formats" aria-hidden="true">
            <span>JPEG</span><span>PNG</span><span>WebP</span>${compact ? "" : "<span>5 Mo max</span>"}
          </div>
        </div>
        <button
          type="button"
          id="${idPrefix}-remove"
          class="pharma-photo-upload__remove-fab${hasImage ? "" : " hidden"}"
          aria-label="Retirer la photo"
          title="Retirer la photo"
        >
          ${PHARMA_PHOTO_UPLOAD_ICONS.close}
        </button>
        <div class="pharma-photo-upload__overlay" aria-hidden="true">
          <span class="pharma-photo-upload__zoom-pill">${compact ? "Agrandir" : "Cliquer pour agrandir"}</span>
        </div>
      </div>
      <div class="pharma-photo-upload__footer">
        <label class="pharma-photo-upload__btn pharma-photo-upload__btn--primary" for="${idPrefix}-input">
          ${PHARMA_PHOTO_UPLOAD_ICONS.upload}
          <span class="pharma-photo-upload__btn-text">${hasImage ? "Changer" : compact ? "Choisir" : "Choisir une photo"}</span>
          <input type="file" id="${idPrefix}-input" accept="image/jpeg,image/png,image/webp" hidden />
        </label>
        <button
          type="button"
          class="pharma-photo-upload__remove-text${hasImage ? "" : " hidden"}"
          data-photo-remove-text="${idPrefix}"
          aria-label="Retirer la photo"
        >
          Supprimer la photo
        </button>
      </div>
    </div>`;
}

function updatePharmaPhotoUploadUi(idPrefix, { hasImage, title, src }) {
  const root = document.getElementById(`${idPrefix}-dropzone`);
  const preview = document.getElementById(`${idPrefix}-preview`);
  const placeholder = document.getElementById(`${idPrefix}-placeholder`);
  const removeFab = document.getElementById(`${idPrefix}-remove`);
  const removeText = root?.querySelector(`[data-photo-remove-text="${idPrefix}"]`);
  const btnText = root?.querySelector(".pharma-photo-upload__btn-text");
  if (!root) return;

  root.classList.toggle("has-image", !!hasImage);
  removeFab?.classList.toggle("hidden", !hasImage);
  removeText?.classList.toggle("hidden", !hasImage);
  if (preview) {
    if (src) preview.src = src;
    preview.classList.toggle("hidden", !hasImage);
    if (hasImage) {
      if (title) preview.setAttribute("data-pharmacy-photo-title", title);
      markPharmacyPhotoZoomable(preview, title || pharmacyPhotoZoomTitle(preview));
    } else {
      preview.src = "";
      unmarkPharmacyPhotoZoomable(preview);
    }
  }
  placeholder?.classList.toggle("hidden", !!hasImage);
  if (btnText) {
    const compact = root.classList.contains("pharma-photo-upload--compact");
    btnText.textContent = hasImage
      ? compact
        ? "Changer"
        : "Changer la photo"
      : compact
        ? "Choisir"
        : "Choisir une photo";
  }
}

function setupPharmaPhotoUpload({ idPrefix, onFile, onRemove }) {
  const root = document.getElementById(`${idPrefix}-dropzone`);
  if (!root) return null;

  const fileInput = document.getElementById(`${idPrefix}-input`);
  const frame = root.querySelector("[data-photo-frame]");
  const removeFab = document.getElementById(`${idPrefix}-remove`);
  const removeText = root.querySelector(`[data-photo-remove-text="${idPrefix}"]`);

  const pickFile = () => fileInput?.click();

  const handleRemove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileInput) fileInput.value = "";
    if (onRemove) onRemove();
  };

  fileInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (file && onFile) await onFile(file);
  });

  removeFab?.addEventListener("click", handleRemove);
  removeText?.addEventListener("click", handleRemove);

  if (frame) {
    frame.addEventListener("click", (e) => {
      if (root.classList.contains("has-image")) return;
      if (e.target.closest("label, button, input")) return;
      pickFile();
    });
  }

  ["dragenter", "dragover"].forEach((ev) => {
    root.addEventListener(ev, (e) => {
      e.preventDefault();
      root.classList.add("is-dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    root.addEventListener(ev, (e) => {
      e.preventDefault();
      root.classList.remove("is-dragover");
    });
  });
  root.addEventListener("drop", async (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file && onFile) await onFile(file);
  });

  return { pickFile };
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
