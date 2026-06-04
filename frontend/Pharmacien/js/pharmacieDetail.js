let pharmacyId = null;
let pharmacy = null;
let stockCache = [];
let currentStockFilter = "";
let stockSearchQuery = "";
let importPreviewItems = [];
let stockMedsListVisible = true;

/** Remet stock / avis hors de #pharmacy-detail avant un re-render (évite leur suppression). */
function restoreSectionsOutsideDetail() {
  const detail = document.getElementById("pharmacy-detail");
  if (!detail?.parentElement) return;
  let anchor = detail;
  for (const id of ["pd-stock-section", "pd-avis-section"]) {
    const el = document.getElementById(id);
    if (el && detail.contains(el)) {
      anchor.insertAdjacentElement("afterend", el);
      anchor = el;
    }
  }
}

/** Place la section stock après les coordonnées. */
function mountStockSection() {
  const stock = document.getElementById("pd-stock-section");
  const detail = document.getElementById("pharmacy-detail");
  if (!stock || !detail) return;
  const page = detail.querySelector(".pd-page");
  const info = page?.querySelector(".pd-info");
  if (page && info) {
    info.insertAdjacentElement("afterend", stock);
  } else if (page) {
    page.appendChild(stock);
  }
  stock.classList.remove("hidden");
}

/** Place la section avis après le stock. */
function mountAvisSection() {
  const avis = document.getElementById("pd-avis-section");
  const stock = document.getElementById("pd-stock-section");
  if (!avis) return;
  if (stock) {
    stock.insertAdjacentElement("afterend", avis);
  }
  avis.classList.remove("hidden");
}

function avisStarsHtml(note) {
  const n = Math.max(0, Math.min(5, Number(note) || 0));
  return `${"★".repeat(n)}${"☆".repeat(5 - n)}`;
}

function renderPharmaAvisCard(a) {
  const dateStr = a.date_creation
    ? new Date(a.date_creation).toLocaleDateString("fr-MA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  return `
    <article class="pd-avis-card">
      <div class="pd-avis-card__head">
        <span class="pd-avis-card__name">${escapeHtml(a.nom_utilisateur || "Client")}</span>
        <span class="pd-avis-card__stars" aria-label="Note ${a.note} sur 5">${avisStarsHtml(a.note)}</span>
      </div>
      ${
        a.commentaire
          ? `<p class="pd-avis-card__text">${escapeHtml(a.commentaire)}</p>`
          : '<p class="pd-avis-card__text pd-avis-card__text--empty muted">Pas de commentaire.</p>'
      }
      <p class="pd-avis-card__date">${dateStr}</p>
    </article>`;
}

function pharmacyAvisAllowed(ph) {
  return typeof pharmaValidationStatut === "function" && pharmaValidationStatut(ph) === "valide";
}

async function loadPharmaAvis() {
  const summaryEl = document.getElementById("pd-avis-summary");
  const listEl = document.getElementById("pd-avis-list");
  const scoreWrap = document.getElementById("pd-avis-score");
  const scoreVal = document.getElementById("pd-avis-score-value");
  if (!summaryEl || !listEl) return;

  if (!pharmacy || !pharmacyAvisAllowed(pharmacy)) {
    summaryEl.textContent = "Avis clients";
    if (scoreWrap) scoreWrap.hidden = true;
    const statut =
      pharmacy && typeof pharmaValidationStatut === "function"
        ? pharmaValidationStatut(pharmacy)
        : "en_attente";
    const hint =
      statut === "refuse"
        ? "Les avis ne sont pas affichés pour une pharmacie refusée."
        : "Les avis s'afficheront lorsque votre pharmacie sera validée par l'administration.";
    listEl.innerHTML = `<div class="pd-avis-empty"><p class="muted">${hint}</p></div>`;
    return;
  }

  listEl.innerHTML = '<p class="muted">Chargement des avis…</p>';
  try {
    const data = await MediCareAPI.getPharmaAvis(pharmacyId);
    const nb = Number(data.nb_avis) || 0;
    const moy =
      data.note_moyenne != null && data.note_moyenne !== ""
        ? Number(data.note_moyenne)
        : null;

    if (nb > 0 && moy != null) {
      summaryEl.textContent = `${nb} avis client${nb > 1 ? "s" : ""}`;
      if (scoreWrap && scoreVal) {
        scoreWrap.hidden = false;
        scoreWrap.setAttribute("aria-hidden", "false");
        scoreVal.textContent = moy.toFixed(1);
      }
    } else {
      summaryEl.textContent = "Aucun avis pour le moment.";
      scoreWrap?.setAttribute("aria-hidden", "true");
      if (scoreWrap) scoreWrap.hidden = true;
    }

    const avis = data.avis || [];
    if (!avis.length) {
      listEl.innerHTML =
        '<div class="pd-avis-empty"><p class="muted">Les avis de vos clients apparaîtront ici.</p></div>';
      return;
    }

    listEl.innerHTML = `<div class="pd-avis-items">${avis.map(renderPharmaAvisCard).join("")}</div>`;
  } catch (err) {
    summaryEl.textContent = "";
    listEl.innerHTML = `<p class="pd-error">${escapeHtml(err.message || "Impossible de charger les avis.")}</p>`;
    const score = document.getElementById("pd-avis-score");
    if (score) score.hidden = true;
  }
}

const STOCK_FILTER_LABELS = {
  "": "au total",
  disponible: "disponible(s)",
  rupture: "en rupture",
};
let editImageDataUrl = null;
let editImageRemove = false;
let editLastGpsAdresse = "";

function editPharmacyStatusBadgeHtml(p) {
  if (typeof pharmaValidationBadgeHtml === "function") {
    return pharmaValidationBadgeHtml(p).trim();
  }
  return "";
}

function editCoordsChipHtml(p) {
  const lat = parseFloat(p.latitude);
  const lon = parseFloat(p.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return '<span class="pd-edit-coords pd-edit-coords--empty muted">Position non enregistrée</span>';
  }
  return `<span class="pd-edit-coords" id="edit-coords-display">GPS : ${lat.toFixed(5)}, ${lon.toFixed(5)}</span>`;
}

function pharmacyEditFormHtml(p) {
  const loc = normalizeQuartierVille(p);
  const imgUrl = pharmacyImageUrl(p.image);
  const hasPreview = imgUrl && !editImageRemove;
  return `
    <div class="pd-pharma-form__scroll">
      <div class="pd-edit-modal">
        <nav class="pd-edit-nav" aria-label="Sections du formulaire">
          <button type="button" class="pd-edit-nav__item is-active" data-edit-section="info" aria-current="step">
            <span class="pd-edit-nav__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
            </span>
            <span class="pd-edit-nav__text"><strong>Identité</strong><small>Nom, photo, contact</small></span>
          </button>
          <button type="button" class="pd-edit-nav__item" data-edit-section="hours">
            <span class="pd-edit-nav__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </span>
            <span class="pd-edit-nav__text"><strong>Horaires</strong><small>Planning hebdomadaire</small></span>
          </button>
          <button type="button" class="pd-edit-nav__item" data-edit-section="location">
            <span class="pd-edit-nav__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
            </span>
            <span class="pd-edit-nav__text"><strong>Adresse</strong><small>Ville, quartier, GPS</small></span>
          </button>
        </nav>

        <div class="pd-edit-modal__panels">
          <section id="edit-section-info" class="pd-edit-panel is-active" data-edit-panel="info">
            <div class="pd-edit-panel__head">
              <h3 class="pd-edit-panel__title">Identité de l'établissement</h3>
              <p class="pd-edit-panel__desc muted">Visible sur votre fiche et la carte publique une fois validée.</p>
            </div>

            <div class="pd-edit-identity-row">
              <div class="pd-edit-photo-slot">
                ${
                  typeof pharmaPhotoUploadHtml === "function"
                    ? pharmaPhotoUploadHtml({
                        idPrefix: "edit-image",
                        imgUrl: hasPreview ? imgUrl : "",
                        title: p.nom,
                        compact: true,
                      })
                    : ""
                }
              </div>
              <div class="pd-edit-identity-fields">
                <div class="pd-form-section pd-form-section--card pd-form-section--flush">
                  <div class="form-grid-2">
                    <label class="pd-form-field pd-form-field--wide">Nom de la pharmacie <span class="required-mark">*</span>
                      <input type="text" name="nom" value="${escapeHtml(p.nom)}" required autocomplete="organization" placeholder="Pharmacie du Centre" />
                    </label>
                    <label class="pd-form-field">Téléphone
                      <input type="tel" name="telephone" value="${escapeHtml(p.telephone || "")}" placeholder="06 12 34 56 78" autocomplete="tel" />
                    </label>
                  </div>
                </div>
                <p class="pd-edit-photo-hint muted">Photo visible sur la carte · clic sur l’aperçu pour agrandir</p>
              </div>
            </div>
          </section>

          <section id="edit-section-hours" class="pd-edit-panel" data-edit-panel="hours" hidden>
            <div class="pd-edit-panel__head">
              <h3 class="pd-edit-panel__title">Horaires d'ouverture</h3>
              <p class="pd-edit-panel__desc muted">Le statut ouvert / fermé est calculé automatiquement selon ces horaires.</p>
            </div>
            <div class="pd-form-section pd-form-section--card pd-hours-section">
              <p class="field-hint muted pd-hours-intro">Renseignez chaque jour. Vous pouvez appliquer le même créneau à tous les jours ouverts.</p>
              <p id="edit-hours-msg" class="pd-edit-hours-msg hidden" role="alert" aria-live="polite"></p>
              ${typeof WeeklyPharmacyHours !== "undefined" ? WeeklyPharmacyHours.editFormHtml(p) : ""}
            </div>
            <p class="field-hint muted pd-hours-footer-hint">Le mode de garde se gère depuis le bouton dédié sur la fiche pharmacie.</p>
          </section>

          <section id="edit-section-location" class="pd-edit-panel" data-edit-panel="location" hidden>
            <div class="pd-edit-panel__head">
              <h3 class="pd-edit-panel__title">Localisation</h3>
              <p class="pd-edit-panel__desc muted">Utilisée pour la carte, la recherche par ville/quartier et l'itinéraire.</p>
            </div>
            <div class="pd-form-section pd-form-section--card pd-location-section">
              <p class="pd-location-note">La ville et le quartier alimentent les filtres de recherche des patients.</p>
              <div class="form-grid-2 pd-location-grid">
                <label class="pd-form-field">Ville <span class="required-mark">*</span>
                  <input type="text" name="ville" value="${escapeHtml(loc.ville)}" required placeholder="Marrakech" autocomplete="address-level2" />
                </label>
                <label class="pd-form-field">Quartier <span class="required-mark">*</span>
                  <input type="text" name="quartier" value="${escapeHtml(loc.quartier)}" required placeholder="Guéliz" autocomplete="address-level3" />
                </label>
              </div>
              <input type="hidden" name="latitude" value="${p.latitude ?? ""}" />
              <input type="hidden" name="longitude" value="${p.longitude ?? ""}" />
              <div class="pd-edit-coords-row">${editCoordsChipHtml(p)}</div>
              <div class="pd-address-block">
                <div class="pd-address-block__toolbar">
                  <span class="pd-address-block__label">Adresse complète <span class="required-mark">*</span></span>
                  <button type="button" class="pd-btn-geo" id="edit-btn-fill-adresse" title="Utiliser la position GPS actuelle de cet appareil">
                    <span class="pd-btn-geo__dot" aria-hidden="true"></span>
                    Ma position actuelle
                  </button>
                </div>
                <label class="pd-form-field pd-form-field--flush">
                  <textarea name="adresse" rows="4" required placeholder="Numéro, rue, repères…">${escapeHtml(p.adresse)}</textarea>
                </label>
                <p class="pd-address-block__help muted">Sur place à la pharmacie, le bouton GPS remplit l'adresse automatiquement. Sinon, saisissez-la à la main.</p>
                <p id="edit-location-msg" class="pd-edit-location-msg hidden" role="alert" aria-live="polite"></p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
    <div class="pharma-modal-footer pd-pharma-modal__footer pd-pharma-modal__footer--edit">
      <p class="pd-edit-footer__hint muted"><span class="required-mark">*</span> Champs obligatoires · les modifications sont visibles après enregistrement</p>
      <div class="pd-edit-footer__actions">
        <button type="button" class="btn btn-outline" data-close-modal="modal-edit-pharmacy">Annuler</button>
        <button type="submit" class="btn btn-teal pd-edit-submit">
          <span class="pd-edit-submit__label">Enregistrer les modifications</span>
        </button>
      </div>
    </div>`;
}

function updateEditCoordsDisplay(form) {
  const chip = document.getElementById("edit-coords-display");
  if (!chip || !form) return;
  const lat = parseFloat(form.latitude?.value);
  const lon = parseFloat(form.longitude?.value);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    chip.textContent = `GPS : ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    chip.className = "pd-edit-coords";
  } else {
    chip.textContent = "Position non enregistrée";
    chip.className = "pd-edit-coords pd-edit-coords--empty muted";
  }
}

function setActiveEditSection(sectionId) {
  const form = document.getElementById("form-edit-pharmacy");
  if (!form) return;
  form.querySelectorAll("[data-edit-section]").forEach((btn) => {
    const active = btn.dataset.editSection === sectionId;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-current", active ? "step" : "false");
  });
  form.querySelectorAll("[data-edit-panel]").forEach((panel) => {
    const active = panel.dataset.editPanel === sectionId;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
}

function setupEditModalNavigation(form) {
  if (!form) return;
  form.querySelectorAll("[data-edit-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.editSection;
      if (id) setActiveEditSection(id);
    });
  });
}

function updateEditModalHeader(p) {
  const sub = document.getElementById("edit-pharmacy-subtitle");
  const badge = document.getElementById("edit-pharmacy-badge");
  const loc = normalizeQuartierVille(p);
  if (sub) {
    const parts = [p.nom];
    if (loc.ville) parts.push(loc.ville);
    sub.textContent = parts.filter(Boolean).join(" · ");
  }
  if (badge) badge.innerHTML = editPharmacyStatusBadgeHtml(p);
}

function openDeletePharmacyModal() {
  const nameEl = document.getElementById("delete-pharmacy-name");
  if (nameEl && pharmacy) nameEl.textContent = pharmacy.nom;
  openPharmaModal("modal-delete-pharmacy");
}

async function toggleManualClose() {
  const btn = document.getElementById("btn-manual-close");
  if (!pharmacyId || !pharmacy) return;
  if (typeof MediCareAPI?.setPharmaManualClose !== "function") {
    alert(
      "Module API obsolète en cache. Rechargez la page avec Ctrl+F5 (api.js doit être à jour)."
    );
    return;
  }
  const willClose = !pharmacy.fermeture_manuelle;
  if (btn) {
    btn.disabled = true;
    btn.classList.add("is-loading");
  }
  try {
    await MediCareAPI.setPharmaManualClose(pharmacyId, willClose);
    pharmacy = await MediCareAPI.getPharmaPharmacy(pharmacyId);
    renderPharmacy();
  } catch (err) {
    const msg = err.message || "Impossible de modifier le statut.";
    alert(
      msg.includes("introuvable") || msg.includes("404")
        ? `${msg}\n\nVérifiez que vous êtes connecté avec le compte propriétaire de cette pharmacie (voir « Mes pharmacies »).`
        : msg
    );
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("is-loading");
    }
  }
}

function openGardeModal() {
  GardePharma.openForPharmacy(pharmacyId, pharmacy.nom, {
    onSuccess: async () => {
      pharmacy = await MediCareAPI.getPharmaPharmacy(pharmacyId);
      renderPharmacy();
    },
  });
}

function setEditLocationMsg(text, type = "error") {
  const el = document.getElementById("edit-location-msg");
  if (!el) return;
  if (!text) {
    el.textContent = "";
    el.hidden = true;
    el.className = "pd-edit-location-msg hidden";
    return;
  }
  el.textContent = text;
  el.hidden = false;
  if (type === "error") {
    el.className = "pd-edit-location-msg error";
  } else if (type === "warn") {
    el.className = "pd-edit-location-msg pd-edit-location-msg--warn";
  } else if (type === "pending") {
    el.className = "pd-edit-location-msg muted";
  } else {
    el.className = "pd-edit-location-msg pd-edit-location-msg--ok";
  }
}

function suggestEditAdresseFromForm(form) {
  const quartier = form.quartier?.value.trim();
  const ville = form.ville?.value.trim();
  if (quartier && ville) return `${quartier}, ${ville}, Maroc`;
  if (ville) return `${ville}, Maroc`;
  return "";
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), ms);
    }),
  ]);
}

async function reverseGeocodeClientFallback(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&accept-language=fr&addressdetails=1&zoom=18`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return "";
    const data = await res.json();
    return String(data.display_name || "").trim();
  } catch {
    return "";
  }
}

async function resolveAdresseFromGpsCoords(lat, lon) {
  const latN = parseFloat(lat);
  const lonN = parseFloat(lon);
  const client = withTimeout(reverseGeocodeClientFallback(latN, lonN), 5500).catch(() => "");
  const server = withTimeout(
    MediCareAPI.pharmaGeocodeReverse(latN, lonN).then((rev) =>
      String(rev?.adresse || "").trim()
    ),
    5500
  ).catch(() => "");

  const [fromClient, fromServer] = await Promise.all([client, server]);
  return (fromClient || fromServer || "").trim();
}

async function syncEditAdresseFromCoords(form, lat, lon) {
  const latN = parseFloat(lat);
  const lonN = parseFloat(lon);
  if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
    return { ok: false, message: "Position invalide." };
  }

  form.latitude.value = latN;
  form.longitude.value = lonN;
  updateEditCoordsDisplay(form);

  const adresse = await resolveAdresseFromGpsCoords(latN, lonN);

  if (adresse) {
    form.adresse.value = adresse;
    form.dataset.adresseSource = "gps";
    editLastGpsAdresse = adresse;
    return { ok: true, fromGps: true };
  }

  const fallback = suggestEditAdresseFromForm(form);
  if (fallback) {
    form.adresse.value = fallback;
    form.dataset.adresseSource = "gps";
    editLastGpsAdresse = fallback;
    return {
      ok: true,
      partial: true,
      fromGps: true,
      message:
        "Position GPS enregistrée. Le service cartographique n'a pas renvoyé la rue : complétez l'adresse (numéro, rue).",
    };
  }

  return {
    ok: false,
    message:
      "Position GPS reçue, mais l'adresse texte est indisponible. Saisissez-la à la main.",
  };
}

async function resolveEditPharmacyCoords(form) {
  const ville = form.ville.value.trim();
  const quartier = form.quartier.value.trim();
  const adresse = form.adresse.value.trim();
  if (!ville || !quartier || !adresse) return null;

  let lat = parseFloat(form.latitude.value);
  let lon = parseFloat(form.longitude.value);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon };
  }

  try {
    const geo = await MediCareAPI.pharmaGeocodeForward({ adresse, ville, quartier });
    form.latitude.value = geo.latitude;
    form.longitude.value = geo.longitude;
    updateEditCoordsDisplay(form);
    return { lat: geo.latitude, lon: geo.longitude };
  } catch {
    return null;
  }
}

function setupEditLocationControls(form) {
  if (!form) return;
  editLastGpsAdresse = "";
  delete form.dataset.adresseSource;
  setEditLocationMsg("");
  updateEditCoordsDisplay(form);

  form.adresse?.addEventListener("input", () => {
    setEditLocationMsg("");
    if (
      form.dataset.adresseSource === "gps" &&
      form.adresse.value.trim() !== editLastGpsAdresse
    ) {
      form.latitude.value = "";
      form.longitude.value = "";
      delete form.dataset.adresseSource;
      updateEditCoordsDisplay(form);
    }
  });

  document.getElementById("edit-btn-fill-adresse")?.addEventListener("click", async () => {
    setEditLocationMsg("");
    const btn = document.getElementById("edit-btn-fill-adresse");
    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-loading");
    }

    setEditLocationMsg("Recherche du signal GPS (quelques secondes)…", "pending");

    const geo = await getFreshUserPosition();
    if (!geo) {
      setEditLocationMsg(
        "Position non reçue : autorisez la géolocalisation ou attendez le GPS, puis réessayez."
      );
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
      }
      return;
    }

    setEditLocationMsg("Position trouvée — calcul de l'adresse…", "pending");
    const result = await syncEditAdresseFromCoords(form, geo.lat, geo.lon);

    if (result.ok) {
      const detail = result.partial
        ? result.message
        : "Adresse remplie depuis votre position actuelle.";
      setEditLocationMsg(detail, result.partial ? "warn" : "ok");
    } else {
      setEditLocationMsg(result.message);
    }
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("is-loading");
    }
  });
}

async function applyEditImageFile(file) {
  if (!file?.type?.startsWith("image/")) {
    alert("Choisissez une image (JPEG, PNG ou WebP).");
    return;
  }
  editImageDataUrl = await resizePharmacyImageFile(file);
  editImageRemove = false;
  const title =
    document.querySelector('#form-edit-pharmacy input[name="nom"]')?.value?.trim() ||
    document.getElementById("edit-pharmacy-subtitle")?.textContent?.trim();
  updatePharmaPhotoUploadUi("edit-image", {
    hasImage: true,
    src: editImageDataUrl,
    title,
  });
}

function setupEditImageControls(pharmacyForZoom) {
  setupPharmaPhotoUpload({
    idPrefix: "edit-image",
    onFile: applyEditImageFile,
    onRemove: () => {
      editImageDataUrl = null;
      editImageRemove = true;
      updatePharmaPhotoUploadUi("edit-image", { hasImage: false });
    },
  });
  const preview = document.getElementById("edit-image-preview");
  if (preview?.src && !preview.classList.contains("hidden") && pharmacyForZoom) {
    markPharmacyPhotoZoomable(preview, pharmacyForZoom.nom);
  }
}

async function showEditModal() {
  try {
    pharmacy = await MediCareAPI.getPharmaPharmacy(pharmacyId);
  } catch (err) {
    alert(err.message || "Impossible de charger la pharmacie.");
    return;
  }
  editImageDataUrl = null;
  editImageRemove = false;
  editLastGpsAdresse = "";
  const form = document.getElementById("form-edit-pharmacy");
  form.innerHTML = pharmacyEditFormHtml(pharmacy);
  updateEditModalHeader(pharmacy);
  setActiveEditSection("info");
  setEditHoursMsg("");
  setupEditModalNavigation(form);
  setupEditImageControls(pharmacy);
  initPharmacyDetailPhotoZoom();
  setupEditLocationControls(form);
  const hoursRoot = form.querySelector("#pd-weekly-hours");
  if (hoursRoot && typeof WeeklyPharmacyHours !== "undefined") {
    WeeklyPharmacyHours.setupForm(hoursRoot);
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const submitLabel = submitBtn?.querySelector(".pd-edit-submit__label");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      if (submitLabel) submitLabel.textContent = "Enregistrement…";
    }
    const f = form;
    const ville = f.ville.value.trim();
    const quartier = f.quartier.value.trim();
    setEditLocationMsg("");
    setEditHoursMsg("");
    if (!ville || !quartier) {
      setEditLocationMsg("Indiquez la ville et le quartier.");
      resetEditSubmitBtn(submitBtn, submitLabel);
      setActiveEditSection("location");
      return;
    }
    const coords = await resolveEditPharmacyCoords(f);
    const hoursEl = hoursRoot || f.querySelector("#pd-weekly-hours");
    let horairesSemaine;
    if (typeof WeeklyPharmacyHours !== "undefined") {
      if (!hoursEl) {
        setEditHoursMsg("Formulaire horaires introuvable — rechargez la page (Ctrl+F5).");
        resetEditSubmitBtn(submitBtn, submitLabel);
        return;
      }
      horairesSemaine = WeeklyPharmacyHours.readFromForm(hoursEl);
      const weekCheck = WeeklyPharmacyHours.validateWeekClient(horairesSemaine);
      if (!weekCheck.ok) {
        setEditHoursMsg(weekCheck.error);
        resetEditSubmitBtn(submitBtn, submitLabel);
        setActiveEditSection("hours");
        return;
      }
    }
    const adresse = f.adresse.value.trim();
    if (!adresse) {
      setEditLocationMsg(
        "Saisissez l'adresse ou utilisez « Remplir depuis ma position actuelle » (sur place à la pharmacie)."
      );
      resetEditSubmitBtn(submitBtn, submitLabel);
      setActiveEditSection("location");
      return;
    }
    if (!coords) {
      setEditLocationMsg(
        "Impossible de placer la pharmacie sur la carte — vérifiez l'adresse, la ville et le quartier."
      );
      resetEditSubmitBtn(submitBtn, submitLabel);
      setActiveEditSection("location");
      return;
    }
    const payload = {
      nom: f.nom.value.trim(),
      adresse,
      quartier: f.quartier.value.trim(),
      ville: f.ville.value.trim(),
      telephone: f.telephone.value.trim() || null,
      horaires_semaine: horairesSemaine,
      latitude: coords.lat,
      longitude: coords.lon,
    };
    if (editImageDataUrl) payload.imageDataUrl = editImageDataUrl;
    else if (editImageRemove) payload.removeImage = true;
    try {
      const saved = await MediCareAPI.updatePharmaPharmacy(pharmacyId, payload);
      closePharmaModal("modal-edit-pharmacy");
      pharmacy = saved.pharmacy || (await MediCareAPI.getPharmaPharmacy(pharmacyId));
      renderPharmacy();
    } catch (err) {
      alert(err.message || "Enregistrement impossible.");
    } finally {
      resetEditSubmitBtn(submitBtn, submitLabel);
    }
  };
  openPharmaModal("modal-edit-pharmacy");
}

function resetEditSubmitBtn(submitBtn, submitLabel) {
  if (!submitBtn) return;
  submitBtn.disabled = false;
  submitBtn.classList.remove("is-loading");
  if (submitLabel) submitLabel.textContent = "Enregistrer les modifications";
}

function isStockDisponible(s) {
  return s.disponible === 1 || s.disponible === true;
}

function formatStockPrix(prix) {
  if (prix == null || prix === "") return "—";
  const n = Number(prix);
  return Number.isFinite(n) ? `${n} DH` : "—";
}

async function setStockDisponible(stockId, disponible) {
  await MediCareAPI.updatePharmaStock(stockId, { disponible });
  const item = stockCache.find((x) => String(x.id) === String(stockId));
  if (item) {
    item.disponible = disponible ? 1 : 0;
    applyStockFilter(currentStockFilter);
    updateStockSummaryChips();
    return;
  }
  await loadStock();
}

function openEditStockModal(stockId) {
  const s = stockCache.find((x) => String(x.id) === String(stockId));
  if (!s) return;

  const titleEl = document.getElementById("modal-edit-stock-title");
  if (titleEl) titleEl.textContent = "Modifier le médicament";

  const form = document.getElementById("form-edit-stock");
  form.innerHTML = `
    <p class="muted">Le statut Disponible / Rupture se gère sur la liste.</p>
    <label>Nom <input type="text" name="nom" value="${escapeHtml(s.nom)}" required minlength="2" /></label>
    <label>Prix (DH) <input type="number" name="prix" step="0.01" min="0" value="${s.prix != null ? s.prix : ""}" placeholder="Optionnel" /></label>
    <div class="pharma-modal-footer">
      <button type="button" class="btn btn-outline" data-close-modal="modal-edit-stock">Annuler</button>
      <button type="submit" class="btn btn-teal">Enregistrer</button>
    </div>`;
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const prixVal = form.prix.value.trim();
    await MediCareAPI.updatePharmaStock(s.id, {
      nom: form.nom.value.trim(),
      prix: prixVal === "" ? null : parseFloat(prixVal),
    });
    closePharmaModal("modal-edit-stock");
    loadStock();
  };
  openPharmaModal("modal-edit-stock");
}

function parseImportPrix(value) {
  const t = String(value ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

const IMPORT_NOM_HEADERS = new Set([
  "nom",
  "name",
  "medicament",
  "produit",
  "designation",
  "libelle",
  "libelle produit",
  "article",
]);

const IMPORT_PRIX_HEADERS = new Set(["prix", "price", "tarif", "montant", "prix dh", "prix (dh)"]);

function normalizeImportHeaderCell(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isImportNomHeader(value) {
  const h = normalizeImportHeaderCell(value);
  return IMPORT_NOM_HEADERS.has(h) || h.includes("medicament") || h === "nom du medicament";
}

function isImportPrixHeader(value) {
  return IMPORT_PRIX_HEADERS.has(normalizeImportHeaderCell(value));
}

/** Repère la ligne d'en-têtes Excel/CSV (nom, prix) sur les 5 premières lignes */
function detectImportColumns(matrix) {
  const rows = Array.isArray(matrix) ? matrix : [];
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const cells = normalizeImportMatrixRow(rows[i]);
    if (!cells.length) continue;
    const nomIdx = cells.findIndex((c) => isImportNomHeader(c));
    if (nomIdx < 0) continue;
    let prixIdx = cells.findIndex((c) => isImportPrixHeader(c));
    if (prixIdx < 0) prixIdx = nomIdx === 0 ? 1 : 0;
    return { startRow: i + 1, nomIdx, prixIdx };
  }
  return { startRow: 0, nomIdx: 0, prixIdx: 1 };
}

function normalizeImportMatrixRow(row) {
  if (!row) return [];
  const cells = Array.isArray(row) ? row : [row];
  return cells.map((c) => String(c ?? "").trim());
}

function lineToImportRow(line) {
  const sep = line.includes(";") ? ";" : line.includes("\t") ? "\t" : line.includes(",") ? "," : null;
  if (sep) {
    return line.split(sep).map((p) => p.trim().replace(/^["']|["']$/g, ""));
  }
  return [line.replace(/^["']|["']$/g, "").trim()];
}

function parseStockImportRows(matrix) {
  const items = [];
  const seen = new Set();
  let skipped = 0;

  const rows = Array.isArray(matrix) ? matrix : [];
  const { startRow, nomIdx, prixIdx } = detectImportColumns(rows);

  for (let i = startRow; i < rows.length; i++) {
    const cells = normalizeImportMatrixRow(rows[i]);
    if (!cells.length) {
      skipped++;
      continue;
    }
    const nom = String(cells[nomIdx] ?? "").trim();
    const prix =
      prixIdx >= 0 && prixIdx < cells.length ? parseImportPrix(cells[prixIdx]) : null;

    if (!nom || nom.length < 2) {
      skipped++;
      continue;
    }
    const key = nom.toLowerCase();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    items.push({ nom, prix, disponible: true });
  }

  return { items, skipped };
}

function parseStockImportText(text) {
  const matrix = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(lineToImportRow);
  return parseStockImportRows(matrix);
}

function isExcelImportFile(file) {
  const n = String(file?.name || "").toLowerCase();
  const mime = String(file?.type || "").toLowerCase();
  if (n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".xlsm")) return true;
  return (
    mime.includes("spreadsheetml") ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/excel"
  );
}

function isExcelBuffer(buf) {
  if (!buf || buf.byteLength < 4) return false;
  const h = new Uint8Array(buf.slice(0, 4));
  if (h[0] === 0x50 && h[1] === 0x4b) return true;
  if (h[0] === 0xd0 && h[1] === 0xcf && h[2] === 0x11 && h[3] === 0xe0) return true;
  return false;
}

function parseExcelBuffer(buf) {
  if (typeof XLSX === "undefined") {
    throw new Error(
      "Lecteur Excel indisponible. Rechargez la page (Ctrl+F5). Le fichier shared/vendor/xlsx.full.min.js doit être présent."
    );
  }
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) throw new Error("Fichier Excel vide (aucune feuille).");
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  const result = parseStockImportRows(rows);
  if (!result.items.length) {
    throw new Error(
      "Aucune ligne reconnue. Mettez le nom en colonne A et le prix en B (ligne 1 : nom | prix)."
    );
  }
  return result;
}

async function readImportStockFile(file) {
  const buf = await file.arrayBuffer();
  if (isExcelImportFile(file) || isExcelBuffer(buf)) {
    return parseExcelBuffer(buf);
  }
  const text = new TextDecoder("utf-8").decode(buf);
  const result = parseStockImportText(text);
  if (!result.items.length && text.trim()) {
    throw new Error("Fichier texte non reconnu. Utilisez nom;prix par ligne ou un fichier .xlsx.");
  }
  return result;
}

function importItemsToPasteText(items) {
  return items
    .map((i) => (i.prix != null && i.prix !== "" ? `${i.nom};${i.prix}` : i.nom))
    .join("\n");
}

function applyImportPreviewResult(items, skipped = 0) {
  importPreviewItems = items;
  const errEl = document.getElementById("import-stock-error");
  if (items.length > 500) {
    importPreviewItems = [];
    if (errEl) {
      errEl.textContent = "Maximum 500 lignes par import.";
      errEl.classList.remove("hidden");
    }
    renderImportPreview();
    return;
  }
  if (!items.length) {
    if (errEl) {
      errEl.textContent =
        "Aucun nom valide. Excel : colonne A = nom, B = prix (optionnel), 1ʳᵉ ligne = en-têtes possible.";
      errEl.classList.remove("hidden");
    }
  } else {
    errEl?.classList.add("hidden");
  }
  renderImportPreview();
  if (skipped > 0 && items.length) {
    const preview = document.getElementById("import-stock-preview");
    if (preview && !preview.classList.contains("hidden")) {
      preview.insertAdjacentHTML(
        "beforeend",
        `<p class="muted">${skipped} ligne(s) ignorée(s) (vide ou doublon).</p>`
      );
    }
  }
}

function renderImportPreview() {
  const preview = document.getElementById("import-stock-preview");
  const confirmBtn = document.getElementById("btn-confirm-import-stock");
  if (!preview || !confirmBtn) return;

  if (!importPreviewItems.length) {
    preview.classList.add("hidden");
    preview.innerHTML = "";
    confirmBtn.disabled = true;
    return;
  }

  const sample = importPreviewItems.slice(0, 8);

  preview.classList.remove("hidden");
  preview.innerHTML = `
    <p><strong>${importPreviewItems.length}</strong> médicament${importPreviewItems.length > 1 ? "s" : ""} à importer — tous <strong>disponibles</strong> pour les clients</p>
    <ul>${sample
      .map((i) => `<li>${escapeHtml(i.nom)} — ${formatStockPrix(i.prix)}</li>`)
      .join("")}</ul>
    ${importPreviewItems.length > 8 ? `<p class="muted">… et ${importPreviewItems.length - 8} autre(s)</p>` : ""}`;
  confirmBtn.disabled = false;
}

function refreshImportPreview() {
  const paste = document.getElementById("import-stock-paste");
  const { items, skipped } = parseStockImportText(paste?.value || "");
  applyImportPreviewResult(items, skipped);
}

function resetImportModal() {
  importPreviewItems = [];
  const file = document.getElementById("import-stock-file");
  const paste = document.getElementById("import-stock-paste");
  const errEl = document.getElementById("import-stock-error");
  const statusEl = document.getElementById("import-stock-status");
  if (file) file.value = "";
  if (paste) paste.value = "";
  errEl?.classList.add("hidden");
  if (statusEl) {
    statusEl.textContent = "";
    statusEl.classList.add("hidden");
  }
  renderImportPreview();
}

function stockMatchesSearch(s) {
  const q = stockSearchQuery.trim().toLowerCase();
  if (!q) return true;
  return String(s.nom || "")
    .toLowerCase()
    .includes(q);
}

function toggleStockSearchUi() {
  const wrap = document.getElementById("stock-search-wrap");
  if (!wrap) return;
  wrap.classList.toggle("hidden", !stockCache.length);
}

function activateStockFilterButton(statut) {
  document.querySelectorAll("[data-stock-statut]").forEach((btn) => {
    const s = btn.getAttribute("data-stock-statut") ?? "";
    btn.classList.toggle("active", s === statut);
  });
}

function renderStockItemHtml(s) {
  const dispo = isStockDisponible(s);
  return `
          <article class="stock-item${dispo ? "" : " stock-rupture"}" data-stock-id="${s.id}">
            <div class="stock-item-body">
              <strong class="stock-item-name">${escapeHtml(s.nom)}</strong>
              <div class="stock-item-status">
                <span class="badge ${dispo ? "badge-disponible" : "badge-rupture"}">${
                  dispo ? "Disponible" : "Rupture"
                }</span>
                <span class="muted" style="font-size:0.8rem">${dispo ? "Visible clients" : "Masqué clients"}</span>
              </div>
              <p class="stock-item-meta">
                <span>Prix <strong>${formatStockPrix(s.prix)}</strong></span>
              </p>
            </div>
            <div class="stock-item-actions">
              <div class="stock-item-actions__tools">
                <div class="stock-status-toggle" role="group" aria-label="Statut pour les clients">
                  <button type="button" class="stock-status-btn stock-status-btn--dispo${dispo ? " is-active" : ""}" data-stock-dispo="${s.id}" aria-pressed="${dispo}">Disponible</button>
                  <button type="button" class="stock-status-btn stock-status-btn--rupture${!dispo ? " is-active" : ""}" data-stock-rupture="${s.id}" aria-pressed="${!dispo}">Rupture</button>
                </div>
                <button type="button" class="btn btn-outline btn-small stock-item-edit-btn" data-edit-stock="${s.id}">Modifier</button>
              </div>
            </div>
          </article>`;
}

function applyStockFilter(statut = currentStockFilter) {
  const el = document.getElementById("stock-list");
  const countEl = document.getElementById("stock-count");
  const filtersBar = document.getElementById("stock-filters-bar");

  currentStockFilter = statut;
  activateStockFilterButton(statut);

  updateStockSummaryChips();
  toggleStockSearchUi();

  if (!stockCache.length) {
    filtersBar?.classList.add("hidden");
    if (countEl) countEl.textContent = "";
    el.innerHTML = `
      <div class="pd-stock-empty">
        <div class="pd-stock-empty__icon" aria-hidden="true">💊</div>
        <p><strong>Aucun médicament dans votre liste</strong></p>
        <p class="muted">Importez un fichier CSV ou ajoutez un nom pour commencer.</p>
        <button type="button" class="btn btn-teal" id="btn-empty-reimport-stock">Importer une nouvelle liste</button>
      </div>`;
    return;
  }

  filtersBar?.classList.remove("hidden");

  let filtered =
    statut === "disponible"
      ? stockCache.filter((s) => isStockDisponible(s))
      : statut === "rupture"
        ? stockCache.filter((s) => !isStockDisponible(s))
        : stockCache;

  if (stockSearchQuery.trim()) {
    filtered = filtered.filter(stockMatchesSearch);
  }

  const label = STOCK_FILTER_LABELS[statut] ?? STOCK_FILTER_LABELS[""];
  const q = stockSearchQuery.trim();
  if (countEl) {
    if (!filtered.length) {
      countEl.textContent = q
        ? `Aucun résultat pour « ${q} »`
        : `Aucun médicament ${label}`;
    } else {
      countEl.textContent = q
        ? `${filtered.length} résultat${filtered.length > 1 ? "s" : ""} pour « ${q} »`
        : `${filtered.length} médicament${filtered.length > 1 ? "s" : ""} ${label}`;
    }
  }

  if (!filtered.length) {
    el.innerHTML = `<p class="muted">${q ? "Essayez un autre terme ou effacez la recherche." : "Aucun médicament pour ce filtre."}</p>`;
    return;
  }

  el.innerHTML = `<div class="stock-items">${filtered.map(renderStockItemHtml).join("")}</div>`;
}

function updateStockListToggleButton() {
  const btn = document.getElementById("btn-toggle-stock-list");
  if (!btn) return;
  btn.textContent = stockMedsListVisible ? "Masquer la liste" : "Afficher la liste";
  btn.setAttribute("aria-expanded", stockMedsListVisible ? "true" : "false");
  btn.classList.toggle("is-collapsed", !stockMedsListVisible);
}

function setStockMedsListVisible(visible) {
  stockMedsListVisible = !!visible;
  const panel = document.getElementById("pd-stock-meds-panel");
  if (panel) panel.classList.toggle("hidden", !stockMedsListVisible);
  updateStockListToggleButton();
}

function openImportStockModal() {
  resetImportModal();
  const hint = document.getElementById("modal-import-stock-hint");
  if (hint) {
    hint.textContent =
      stockCache.length > 0
        ? "Les médicaments déjà présents seront mis à jour ; les nouveaux seront ajoutés. Tous seront marqués disponibles."
        : "Tous les médicaments importés seront marqués disponibles pour les clients.";
  }
  openPharmaModal("modal-import-stock");
}

function refreshStockUi() {
  const listEl = document.getElementById("stock-list");
  if (!listEl) return;
  if (stockCache.length) {
    applyStockFilter(currentStockFilter);
    updateStockSummaryChips();
    setStockMedsListVisible(stockMedsListVisible);
  } else if (pharmacyId) {
    loadStock();
  }
}

async function loadStock() {
  const el = document.getElementById("stock-list");
  if (!el) return;
  el.innerHTML = '<p class="muted">Chargement…</p>';
  try {
    stockCache = await MediCareAPI.getPharmaStock(pharmacyId);
    stockCache.sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr"));
    applyStockFilter(currentStockFilter);
    updateStockSummaryChips();
    setStockMedsListVisible(true);
  } catch (err) {
    document.getElementById("stock-filters-bar")?.classList.add("hidden");
    const msg = err.message || err.detail || "Erreur serveur";
    el.innerHTML = `
      <p class="pd-error">${escapeHtml(msg)}</p>
      <p class="muted" style="margin-top:0.75rem;font-size:0.85rem;line-height:1.5">
        Dans le dossier <code>backend</code> : <code>npm run migrate:stock</code> puis <code>npm start</code>.
        Ouvrez le site via <a href="http://localhost:3000/Pharmacien/html/pharmacie.html">http://localhost:3000</a> (pas le port 5500).
      </p>`;
  }
}

function detailHeaderBadges(p) {
  let badges = pharmaStatusPill(p);
  if (p.est_de_garde && pharmaValidationStatut(p) !== "valide") {
    badges += ' <span class="badge badge-garde">De garde</span>';
  }
  return badges;
}

function pdClientState(ph) {
  if (ph.est_de_garde) return "De garde";
  if (ph.fermeture_manuelle) return "Fermée";
  if (typeof pharmacyIsEffectivelyOpen === "function" && pharmacyIsEffectivelyOpen(ph)) {
    return "Ouverte";
  }
  return "Fermée";
}

function pdFormatRating(note) {
  if (note == null || note === "") return "—";
  const n = Number(note);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)} ★`;
}

function pdHeroMedia(imgUrl, altName) {
  if (imgUrl) {
    return `
      <button
        type="button"
        class="pd-hero__thumb pd-hero__thumb--zoom"
        data-pharmacy-photo="${escapeHtml(imgUrl)}"
        data-pharmacy-photo-title="${escapeHtml(altName)}"
        aria-label="Voir la photo de ${escapeHtml(altName)} en grand"
      >
        <img src="${escapeHtml(imgUrl)}" alt="" />
        <span class="pd-hero__thumb-zoom" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/>
          </svg>
        </span>
      </button>`;
  }
  return `
    <div class="pd-hero__thumb pd-hero__thumb--placeholder" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="9" y="9" width="2" height="2" fill="currentColor" stroke="none"/>
        <rect x="13" y="13" width="2" height="2" fill="currentColor" stroke="none"/>
      </svg>
    </div>`;
}

function pdStatusTiles(ph) {
  const clientOpen = pdClientState(ph);
  const clientTileClass =
    clientOpen === "Fermée"
      ? "pd-status-tile--closed"
      : clientOpen === "De garde"
        ? "pd-status-tile--garde"
        : "";
  const validation = pharmaValidationStatut(ph);
  const validationLabel =
    validation === "valide"
      ? "Validée"
      : validation === "refuse"
        ? "Refusée"
        : "En attente admin";
  const validationClass = validation === "en_attente" ? " pd-status-tile--pending" : "";

  return `
    <div class="pd-status-grid">
      <div class="pd-status-tile${clientTileClass ? ` ${clientTileClass}` : ""}">
        <div class="pd-status-tile__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
          </svg>
        </div>
        <div>
          <p class="pd-status-tile__label">Pour les clients</p>
          <p class="pd-status-tile__value">${escapeHtml(clientOpen)}</p>
          <p class="pd-status-tile__hint">${
            ph.fermeture_manuelle
              ? "Fermeture manuelle — les horaires sont ignorés aujourd'hui"
              : "Selon les horaires du jour et la garde"
          }</p>
        </div>
      </div>
      <div class="pd-status-tile${ph.est_de_garde ? " pd-status-tile--garde" : ""}">
        <div class="pd-status-tile__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
        <div>
          <p class="pd-status-tile__label">Mode de garde</p>
          <p class="pd-status-tile__value">${ph.est_de_garde ? "Activé" : "Inactif"}</p>
          <p class="pd-status-tile__hint">Bouton « Mode de garde » sur la fiche</p>
        </div>
      </div>
      <div class="pd-status-tile${validationClass}">
        <div class="pd-status-tile__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12l2 2 4-4"/><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div>
          <p class="pd-status-tile__label">Plateforme</p>
          <p class="pd-status-tile__value">${escapeHtml(validationLabel)}</p>
          <p class="pd-status-tile__hint">${pharmaValidationStatut(ph) === "valide" ? "Visible sur la carte publique" : pharmaValidationStatut(ph) === "refuse" ? "Refusée par l'administrateur" : "Masquée jusqu'à validation"}</p>
        </div>
      </div>
      <div class="pd-status-tile">
        <div class="pd-status-tile__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
        <div>
          <p class="pd-status-tile__label">Réputation</p>
          <p class="pd-status-tile__value">${pdFormatRating(ph.note_moyenne)}</p>
          <p class="pd-status-tile__hint">${ph.nb_avis ?? 0} avis client${(ph.nb_avis ?? 0) !== 1 ? "s" : ""}</p>
        </div>
      </div>
    </div>`;
}

function updateStockSummaryChips() {
  const summary = document.getElementById("pd-stock-summary");
  const chipDispo = document.getElementById("pd-chip-dispo");
  const chipRupture = document.getElementById("pd-chip-rupture");
  if (!summary || !chipDispo || !chipRupture) return;

  const dispo = stockCache.filter((s) => isStockDisponible(s)).length;
  const rupture = stockCache.length - dispo;

  if (!stockCache.length) {
    summary.hidden = true;
    return;
  }
  summary.hidden = false;
  chipDispo.textContent = `${dispo} disponible${dispo !== 1 ? "s" : ""}`;
  chipRupture.textContent = `${rupture} en rupture`;
}

function setEditHoursMsg(text, tone = "error") {
  const el = document.getElementById("edit-hours-msg");
  if (!el) return;
  if (!text) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove("pd-edit-hours-msg--ok", "pd-edit-hours-msg--warn");
    return;
  }
  el.textContent = text;
  el.classList.remove("hidden", "pd-edit-hours-msg--ok", "pd-edit-hours-msg--warn");
  if (tone === "ok") el.classList.add("pd-edit-hours-msg--ok");
  else if (tone === "warn") el.classList.add("pd-edit-hours-msg--warn");
}

function renderPharmacy() {
  const el = document.getElementById("pharmacy-detail");
  if (!el || !pharmacy) return;

  restoreSectionsOutsideDetail();

  const crumb = document.getElementById("pd-breadcrumb-name");
  if (crumb) crumb.textContent = pharmacy.nom;
  document.title = `${pharmacy.nom} — MediCare+ Pro`;

  try {
  const loc = normalizeQuartierVille(pharmacy);
  const s = pharmacy.stats_30j || { VUE: 0, APPEL: 0, RECHERCHE: 0 };
  const imgUrl = pharmacyImageUrl(pharmacy.image);
  const gps =
    pharmacy.latitude != null && pharmacy.longitude != null
      ? `${Number(pharmacy.latitude).toFixed(6)}, ${Number(pharmacy.longitude).toFixed(6)}`
      : "Non renseigné";

  el.innerHTML = `
    <div class="pd-page">
      <article class="pd-hero">
        <div class="pd-hero__inner">
        ${pdHeroMedia(imgUrl, pharmacy.nom)}
        <div class="pd-hero__body">
          <div class="pd-hero__top">
            <div class="pd-hero__title-block">
              <p class="pd-hero__eyebrow">Mon établissement</p>
              <h1>${escapeHtml(pharmacy.nom)}</h1>
              <div class="pd-hero__badges">${detailHeaderBadges(pharmacy)} ${pharmaValidationBadgeHtml(pharmacy)}</div>
            </div>
            <div class="pd-hero__actions">
              <a href="#pd-stock-section" class="btn btn-outline btn-small pd-hero__stock-link">Stock médicaments</a>
              <button type="button" id="btn-garde-main" class="btn btn-garde pd-hero__garde-btn${pharmacy.est_de_garde ? " is-active" : ""}">
                ${pharmacy.est_de_garde ? "Gérer la garde" : "Mode de garde"}
              </button>
              <button type="button" id="btn-manual-close" class="btn btn-small pd-hero__close-btn${pharmacy.fermeture_manuelle ? " is-manual-closed" : ""}"${
                pharmacy.est_de_garde ? ' title="Désactivez la garde pour marquer fermée"' : ""
              }>
                ${pharmacy.fermeture_manuelle ? "Marquer ouverte" : "Marquer fermée"}
              </button>
            </div>
          </div>
          <div class="pd-hero__toolbar" aria-label="Gestion de la pharmacie">
            <button type="button" id="btn-edit-pharmacy" class="btn btn-teal btn-small">Modifier la pharmacie</button>
            <button type="button" id="btn-delete-pharmacy" class="btn btn-danger btn-small">Supprimer</button>
          </div>
        </div>
        </div>
      </article>

      ${pdStatusTiles(pharmacy)}

      <section class="pd-stats" aria-labelledby="pd-stats-title">
        <header class="pd-section-head">
          <h2 id="pd-stats-title">Performance — 30 derniers jours</h2>
          <p class="muted">Interactions sur votre fiche publique</p>
        </header>
        <div class="pd-stats-grid stats-grid">
          <div class="stat-card">
            <span class="stat-card__icon" aria-hidden="true">👁</span>
            <div class="stat-value">${s.VUE}</div>
            <div class="stat-label">Vues de fiche</div>
          </div>
          <div class="stat-card accent-orange">
            <span class="stat-card__icon" aria-hidden="true">📞</span>
            <div class="stat-value">${s.APPEL}</div>
            <div class="stat-label">Appels</div>
          </div>
          <div class="stat-card accent-blue">
            <span class="stat-card__icon" aria-hidden="true">💊</span>
            <div class="stat-value">${s.RECHERCHE}</div>
            <div class="stat-label">Recherches médicament</div>
          </div>
          <div class="stat-card stat-card--rating accent-violet">
            <span class="stat-card__icon" aria-hidden="true">⭐</span>
            <div class="stat-value">${pharmacy.note_moyenne != null ? Number(pharmacy.note_moyenne).toFixed(1) : "—"}</div>
            <div class="stat-label">Note · ${pharmacy.nb_avis ?? 0} avis</div>
          </div>
        </div>
      </section>

      <section class="pd-info" aria-labelledby="pd-info-title">
        <header class="pd-section-head">
          <h2 id="pd-info-title">Coordonnées & horaires</h2>
        </header>
        <div class="pd-info-grid">
          <div class="pd-info-card pd-info-card--wide">
            <div class="pd-info-card__icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div>
              <p class="pd-info-card__label">Adresse</p>
              <p class="pd-info-card__value">${escapeHtml(pharmacy.adresse)}</p>
            </div>
          </div>
          <div class="pd-info-card">
            <div class="pd-info-card__icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 21h18M6 21V7l6-3 6 3v14"/>
              </svg>
            </div>
            <div>
              <p class="pd-info-card__label">Quartier · Ville</p>
              <p class="pd-info-card__value">${escapeHtml(loc.quartier || "—")} · ${escapeHtml(loc.ville || "—")}</p>
            </div>
          </div>
          <div class="pd-info-card">
            <div class="pd-info-card__icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
            </div>
            <div>
              <p class="pd-info-card__label">Téléphone</p>
              <p class="pd-info-card__value">${escapeHtml(pharmacy.telephone || "—")}</p>
            </div>
          </div>
          <div class="pd-info-card">
            <div class="pd-info-card__icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
              </svg>
            </div>
            <div>
              <p class="pd-info-card__label">Horaires</p>
              <ul class="pd-info-hours-list">${
                typeof WeeklyPharmacyHours !== "undefined"
                  ? WeeklyPharmacyHours.listDisplayHtml(pharmacy)
                  : `<li>${escapeHtml(pharmacy.heure_ouverture || "—")} – ${escapeHtml(pharmacy.heure_fermeture || "—")}</li>`
              }</ul>
            </div>
          </div>
          <div class="pd-info-card">
            <div class="pd-info-card__icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/>
              </svg>
            </div>
            <div>
              <p class="pd-info-card__label">GPS</p>
              <p class="pd-info-card__value pd-gps">${escapeHtml(gps)}</p>
            </div>
          </div>
        </div>
      </section>
    </div>`;

  document.getElementById("btn-edit-pharmacy")?.addEventListener("click", showEditModal);
  document.getElementById("btn-garde-main")?.addEventListener("click", openGardeModal);
  document.getElementById("btn-manual-close")?.addEventListener("click", toggleManualClose);
  document.getElementById("btn-delete-pharmacy")?.addEventListener("click", openDeletePharmacyModal);
  mountStockSection();
  mountAvisSection();
  refreshStockUi();
  } catch (err) {
    console.error("renderPharmacy:", err);
    el.innerHTML = `<p class="pd-error">Impossible d'afficher la pharmacie : ${escapeHtml(err.message || String(err))}</p>`;
    restoreSectionsOutsideDetail();
    refreshStockUi();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!initPharmaPage()) return;
  initPharmacyDetailPhotoZoom();
  setupModalClose();

  pharmacyId = new URLSearchParams(location.search).get("id");
  if (!pharmacyId) {
    document.getElementById("pharmacy-detail").innerHTML =
      '<p class="pd-error">Pharmacie non spécifiée.</p>';
    return;
  }

  try {
    pharmacy = await MediCareAPI.getPharmaPharmacy(pharmacyId);
    renderPharmacy();
    stockMedsListVisible = true;
    updateStockListToggleButton();
    if (!stockCache.length) await loadStock();
    else refreshStockUi();
    await loadPharmaAvis();
  } catch (err) {
    document.getElementById("pharmacy-detail").innerHTML = `<p class="pd-error">${escapeHtml(err.message)}</p>`;
    restoreSectionsOutsideDetail();
    try {
      await loadStock();
    } catch {
      /* ignore */
    }
    return;
  }

  document.getElementById("btn-toggle-stock-list")?.addEventListener("click", () => {
    setStockMedsListVisible(!stockMedsListVisible);
  });

  document.getElementById("btn-reimport-stock")?.addEventListener("click", openImportStockModal);

  document.getElementById("btn-add-stock")?.addEventListener("click", () =>
    openPharmaModal("modal-add-stock")
  );

  const stockSearchInput = document.getElementById("stock-search-q");
  const stockSearchClear = document.getElementById("stock-search-clear");
  stockSearchInput?.addEventListener("input", () => {
    stockSearchQuery = stockSearchInput.value;
    stockSearchClear?.classList.toggle("hidden", !stockSearchQuery.trim());
    applyStockFilter(currentStockFilter);
  });
  stockSearchClear?.addEventListener("click", () => {
    stockSearchQuery = "";
    stockSearchInput.value = "";
    stockSearchClear.classList.add("hidden");
    applyStockFilter(currentStockFilter);
    stockSearchInput.focus();
  });

  document.getElementById("import-stock-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const paste = document.getElementById("import-stock-paste");
    const errEl = document.getElementById("import-stock-error");
    const statusEl = document.getElementById("import-stock-status");
    if (statusEl) {
      statusEl.textContent = `Lecture de ${file.name}…`;
      statusEl.classList.remove("hidden");
    }
    if (errEl) errEl.classList.add("hidden");
    try {
      const { items, skipped } = await readImportStockFile(file);
      if (paste) paste.value = importItemsToPasteText(items);
      if (statusEl) {
        statusEl.textContent = `Fichier « ${file.name} » : ${items.length} médicament(s) détecté(s).`;
      }
      applyImportPreviewResult(items, skipped);
    } catch (err) {
      importPreviewItems = [];
      renderImportPreview();
      if (statusEl) statusEl.classList.add("hidden");
      if (errEl) {
        errEl.textContent = err.message || "Impossible de lire ce fichier.";
        errEl.classList.remove("hidden");
      }
    }
    e.target.value = "";
  });

  document.getElementById("import-stock-paste")?.addEventListener("input", refreshImportPreview);

  document.getElementById("btn-download-stock-template")?.addEventListener("click", () => {
    const csv = "nom;prix\nDoliprane 1000mg;25\nAmoxicilline 500mg;45\nEfferalgan;18\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modele-stock-medicare.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("btn-download-stock-template-xlsx")?.addEventListener("click", () => {
    if (typeof XLSX === "undefined") {
      alert("Lecteur Excel indisponible. Rechargez la page avec une connexion internet.");
      return;
    }
    const ws = XLSX.utils.aoa_to_sheet([
      ["nom", "prix"],
      ["Doliprane 1000mg", 25],
      ["Amoxicilline 500mg", 45],
      ["Efferalgan", 18],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");
    XLSX.writeFile(wb, "modele-stock-medicare.xlsx");
  });

  document.getElementById("btn-confirm-import-stock")?.addEventListener("click", async () => {
    if (!importPreviewItems.length) return;
    const btn = document.getElementById("btn-confirm-import-stock");
    btn.disabled = true;
    try {
      const result = await MediCareAPI.importPharmaStock(pharmacyId, importPreviewItems);
      closePharmaModal("modal-import-stock");
      resetImportModal();
      await loadStock();
      const msg = `${result.imported ?? importPreviewItems.length} médicament(s) importé(s).`;
      if (result.skipped > 0) {
        alert(`${msg}\n${result.skipped} ligne(s) ignorée(s).`);
      } else {
        alert(msg);
      }
    } catch (err) {
      const errEl = document.getElementById("import-stock-error");
      if (errEl) {
        errEl.textContent = err.message || "Import impossible.";
        errEl.classList.remove("hidden");
      }
      btn.disabled = false;
    }
  });

  document.querySelectorAll("[data-stock-statut]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyStockFilter(btn.getAttribute("data-stock-statut") ?? "");
    });
  });

  document.getElementById("pd-stock-section")?.addEventListener("click", (e) => {
    if (e.target.closest("#btn-empty-reimport-stock")) openImportStockModal();
  });

  document.getElementById("stock-list").addEventListener("click", async (e) => {
    const ruptureBtn = e.target.closest("[data-stock-rupture]");
    if (ruptureBtn && !ruptureBtn.classList.contains("is-active")) {
      await setStockDisponible(ruptureBtn.dataset.stockRupture, false);
      return;
    }
    const dispoBtn = e.target.closest("[data-stock-dispo]");
    if (dispoBtn && !dispoBtn.classList.contains("is-active")) {
      await setStockDisponible(dispoBtn.dataset.stockDispo, true);
      return;
    }
    const editBtn = e.target.closest("[data-edit-stock]");
    if (editBtn) openEditStockModal(editBtn.dataset.editStock);
  });

  document.getElementById("confirm-delete-pharmacy").addEventListener("click", async () => {
    const btn = document.getElementById("confirm-delete-pharmacy");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Suppression…";
    }
    try {
      await MediCareAPI.deletePharmaPharmacy(pharmacyId);
      window.location.href = "pharmacie.html";
    } catch (err) {
      alert(err.message || "Suppression impossible.");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Supprimer définitivement";
      }
    }
  });

  document.getElementById("form-add-stock").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const prixVal = f.prix?.value?.trim();
    await MediCareAPI.addPharmaStock(pharmacyId, {
      nom: f.nom.value.trim(),
      prix: prixVal ? parseFloat(prixVal) : null,
      disponible: true,
    });
    closePharmaModal("modal-add-stock");
    f.reset();
    loadStock();
  });

});
