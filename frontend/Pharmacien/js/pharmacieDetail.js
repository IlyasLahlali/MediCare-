let pharmacyId = null;
let pharmacy = null;
let pendingToggle = null;
let deleteStockId = null;
let stockCache = [];
let currentStockFilter = "";

const STOCK_FILTER_LABELS = {
  "": "au total",
  disponible: "disponible(s)",
  rupture: "en rupture",
};
let editImageDataUrl = null;
let editImageRemove = false;

function pharmacyEditFormHtml(p) {
  const loc = normalizeQuartierVille(p);
  const imgUrl = pharmacyImageUrl(p.image);
  return `
    <div class="image-upload-zone">
      <p class="muted" style="margin:0 0 0.5rem;font-weight:600">Photo de la pharmacie</p>
      <img id="edit-image-preview" class="image-preview${imgUrl && !editImageRemove ? "" : " hidden"}" alt="Aperçu" src="${imgUrl && !editImageRemove ? imgUrl : ""}" />
      <p id="edit-image-placeholder" class="muted${imgUrl && !editImageRemove ? " hidden" : ""}">Aucune photo — ajoutez une image de votre pharmacie</p>
      <div class="image-upload-actions">
        <label class="btn btn-outline btn-small">
          ${imgUrl && !editImageRemove ? "Changer la photo" : "Choisir une photo"}
          <input type="file" id="edit-image-input" accept="image/jpeg,image/png,image/webp" hidden />
        </label>
        <button type="button" id="edit-image-remove" class="btn btn-outline btn-small${imgUrl && !editImageRemove ? "" : " hidden"}">Retirer la photo</button>
      </div>
    </div>
    <label>Nom <input type="text" name="nom" value="${escapeHtml(p.nom)}" required /></label>
    <label>Adresse <textarea name="adresse" rows="2" required>${escapeHtml(p.adresse)}</textarea></label>
    <div class="form-grid-2">
      <label>Ville <span class="required-mark">*</span>
        <input type="text" name="ville" value="${escapeHtml(loc.ville)}" required placeholder="Ex. Marrakech" /></label>
      <label>Quartier <span class="required-mark">*</span>
        <input type="text" name="quartier" value="${escapeHtml(loc.quartier)}" required placeholder="Ex. Guéliz, Médina…" /></label>
      <p class="field-hint muted">Ville et quartier : recherche publique. L’adresse complète sert à la carte et à l’itinéraire.</p>
    </div>
    <label>Téléphone <input type="tel" name="telephone" value="${escapeHtml(p.telephone || "")}" /></label>
    <div class="form-grid-2">
      <label>Ouverture <input type="time" name="heure_ouverture" value="${p.heure_ouverture || ""}" /></label>
      <label>Fermeture <input type="time" name="heure_fermeture" value="${p.heure_fermeture || ""}" /></label>
    </div>
    <div class="form-grid-2">
      <label>Latitude <input type="number" step="any" name="latitude" value="${p.latitude ?? ""}" /></label>
      <label>Longitude <input type="number" step="any" name="longitude" value="${p.longitude ?? ""}" /></label>
    </div>
    <label><input type="checkbox" name="est_ouverte" ${p.est_ouverte ? "checked" : ""} /> Ouverte</label>
    <p class="muted">Mode de garde : utilisez le bouton « Mode de garde » sur cette page.</p>
    <div class="pharma-modal-footer">
      <button type="button" class="btn btn-outline" data-close-modal="modal-edit-pharmacy">Annuler</button>
      <button type="submit" class="btn btn-teal">Enregistrer</button>
    </div>`;
}

function openGardeModal() {
  GardePharma.openForPharmacy(pharmacyId, pharmacy.nom, {
    onSuccess: async () => {
      pharmacy = await MediCareAPI.getPharmaPharmacy(pharmacyId);
      renderPharmacy();
    },
  });
}

function setupEditImageControls() {
  const preview = document.getElementById("edit-image-preview");
  const placeholder = document.getElementById("edit-image-placeholder");
  const removeBtn = document.getElementById("edit-image-remove");
  const fileInput = document.getElementById("edit-image-input");

  fileInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Choisissez une image (JPEG, PNG ou WebP).");
      return;
    }
    editImageDataUrl = await resizePharmacyImageFile(file);
    editImageRemove = false;
    preview.src = editImageDataUrl;
    preview.classList.remove("hidden");
    placeholder.classList.add("hidden");
    removeBtn?.classList.remove("hidden");
    const label = fileInput.closest("label");
    if (label) label.firstChild.textContent = "Changer la photo ";
  });

  removeBtn?.addEventListener("click", () => {
    editImageDataUrl = null;
    editImageRemove = true;
    preview.src = "";
    preview.classList.add("hidden");
    placeholder.classList.remove("hidden");
    removeBtn.classList.add("hidden");
    fileInput.value = "";
    const label = fileInput.closest("label");
    if (label) label.firstChild.textContent = "Choisir une photo ";
  });
}

function showEditModal() {
  editImageDataUrl = null;
  editImageRemove = false;
  const form = document.getElementById("form-edit-pharmacy");
  form.innerHTML = pharmacyEditFormHtml(pharmacy);
  setupEditImageControls();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = form;
    const payload = {
      nom: f.nom.value.trim(),
      adresse: f.adresse.value.trim(),
      quartier: f.quartier.value.trim(),
      ville: f.ville.value.trim(),
      telephone: f.telephone.value.trim() || null,
      heure_ouverture: f.heure_ouverture.value || null,
      heure_fermeture: f.heure_fermeture.value || null,
      latitude: f.latitude.value ? parseFloat(f.latitude.value) : null,
      longitude: f.longitude.value ? parseFloat(f.longitude.value) : null,
      est_ouverte: f.est_ouverte.checked,
    };
    if (editImageDataUrl) payload.imageDataUrl = editImageDataUrl;
    else if (editImageRemove) payload.removeImage = true;
    await MediCareAPI.updatePharmaPharmacy(pharmacyId, payload);
    closePharmaModal("modal-edit-pharmacy");
    pharmacy = await MediCareAPI.getPharmaPharmacy(pharmacyId);
    renderPharmacy();
  };
  openPharmaModal("modal-edit-pharmacy");
}

function showToggleModal(field, newValue) {
  pendingToggle = { field, newValue };
  const labels = {
    est_ouverte: newValue ? "ouvrir" : "fermer",
    est_de_garde: newValue ? "activer le mode de garde" : "désactiver le mode de garde",
  };
  document.getElementById("modal-toggle-title").textContent = "Confirmer le changement";
  document.getElementById("modal-toggle-text").textContent =
    `Voulez-vous ${labels[field]} cette pharmacie ?`;
  openPharmaModal("modal-toggle");
}

function isStockDisponible(s) {
  return Number(s.quantite) > 0;
}

async function setStockDisponible(stockId, disponible) {
  await MediCareAPI.updatePharmaStock(stockId, {
    quantite: disponible ? 1 : 0,
  });
  await loadStock();
}

function openEditStockModal(stockId, options = {}) {
  const remettreDisponible = options.remettreDisponible === true;
  const s = stockCache.find((x) => String(x.id) === String(stockId));
  if (!s) return;

  const titleEl = document.getElementById("modal-edit-stock-title");
  if (titleEl) {
    titleEl.textContent = remettreDisponible
      ? "Remettre disponible"
      : "Modifier le médicament";
  }

  const form = document.getElementById("form-edit-stock");
  const hint = remettreDisponible
    ? "<p class=\"muted\">Vérifiez les informations puis validez : le médicament sera à nouveau visible pour les clients.</p>"
    : `<p class="muted">Statut client : ${isStockDisponible(s) ? "Disponible" : "Rupture"} — utilisez « Rupture » sur la liste pour masquer temporairement.</p>`;
  const submitLabel = remettreDisponible ? "Remettre disponible" : "Enregistrer";

  form.innerHTML = `
    ${hint}
    <label>Nom <input type="text" name="nom" value="${escapeHtml(s.nom)}" required /></label>
    <label>Description <textarea name="description" rows="2">${escapeHtml(s.description || "")}</textarea></label>
    <label>Prix (DH) <input type="number" step="0.01" name="prix" value="${s.prix ?? ""}" /></label>
    <div class="pharma-modal-footer">
      <button type="button" class="btn btn-outline" data-close-modal="modal-edit-stock">Annuler</button>
      <button type="submit" class="btn btn-teal">${submitLabel}</button>
    </div>`;
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const payload = {
      nom: form.nom.value.trim(),
      description: form.description.value.trim() || null,
      prix: form.prix.value ? parseFloat(form.prix.value) : null,
    };
    if (remettreDisponible) payload.quantite = 1;
    await MediCareAPI.updatePharmaStock(s.id, payload);
    closePharmaModal("modal-edit-stock");
    loadStock();
  };
  openPharmaModal("modal-edit-stock");
}

function openDeleteStockModal(stockId) {
  const s = stockCache.find((x) => String(x.id) === String(stockId));
  if (!s) return;
  deleteStockId = stockId;
  document.getElementById("delete-stock-text").textContent =
    `Retirer définitivement « ${s.nom} » de votre liste ? (Préférez « Rupture » pour une indisponibilité temporaire.)`;
  openPharmaModal("modal-delete-stock");
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
          <article class="stock-item${dispo ? "" : " stock-rupture"}">
            <div class="stock-item-body">
              <strong class="stock-item-name">${escapeHtml(s.nom)}</strong>
              <div class="stock-item-status">
                <span class="badge ${dispo ? "badge-disponible" : "badge-rupture"}">${
                  dispo ? "Disponible — visible clients" : "Rupture — masqué clients"
                }</span>
              </div>
              ${s.description ? `<p class="muted stock-item-desc">${escapeHtml(s.description)}</p>` : ""}
              <p class="stock-item-meta">
                <span>Prix : <strong>${s.prix != null ? `${s.prix} DH` : "—"}</strong></span>
              </p>
            </div>
            <div class="stock-item-actions">
              ${
                dispo
                  ? `<button type="button" class="btn btn-outline btn-small" data-stock-rupture="${s.id}">Rupture</button>`
                  : `<button type="button" class="btn btn-teal btn-small" data-stock-disponible="${s.id}">Remettre disponible</button>`
              }
              <button type="button" class="btn btn-outline btn-small" data-edit-stock="${s.id}">Modifier</button>
              <button type="button" class="btn btn-danger btn-small" data-del-stock="${s.id}">Retirer</button>
            </div>
          </article>`;
}

function applyStockFilter(statut = currentStockFilter) {
  const el = document.getElementById("stock-list");
  const countEl = document.getElementById("stock-count");
  const filtersEl = document.getElementById("stock-filters");

  currentStockFilter = statut;
  activateStockFilterButton(statut);

  if (!stockCache.length) {
    filtersEl?.classList.add("hidden");
    if (countEl) countEl.textContent = "";
    el.innerHTML = '<p class="muted">Aucun médicament. Ajoutez-en un avec le bouton ci-dessus.</p>';
    return;
  }

  filtersEl?.classList.remove("hidden");

  const filtered =
    statut === "disponible"
      ? stockCache.filter((s) => isStockDisponible(s))
      : statut === "rupture"
        ? stockCache.filter((s) => !isStockDisponible(s))
        : stockCache;

  const label = STOCK_FILTER_LABELS[statut] ?? STOCK_FILTER_LABELS[""];
  if (countEl) {
    countEl.textContent = filtered.length
      ? `${filtered.length} médicament${filtered.length > 1 ? "s" : ""} ${label}`
      : `Aucun médicament ${label}`;
  }

  if (!filtered.length) {
    el.innerHTML = '<p class="muted">Aucun médicament pour ce filtre.</p>';
    return;
  }

  el.innerHTML = `<div class="stock-items">${filtered.map(renderStockItemHtml).join("")}</div>`;
}

async function loadStock() {
  const el = document.getElementById("stock-list");
  el.innerHTML = '<p class="muted">Chargement…</p>';
  try {
    stockCache = await MediCareAPI.getPharmaStock(pharmacyId);
    stockCache.sort(
      (a, b) =>
        (isStockDisponible(b) ? 1 : 0) - (isStockDisponible(a) ? 1 : 0) ||
        String(a.nom).localeCompare(String(b.nom), "fr")
    );
    applyStockFilter(currentStockFilter);
  } catch (err) {
    document.getElementById("stock-filters")?.classList.add("hidden");
    el.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

function detailHeaderBadges(p) {
  let badges = pharmaStatusPill(p);
  if (p.est_de_garde && !p.est_active) {
    badges += ' <span class="badge badge-garde">De garde</span>';
  }
  return badges;
}

async function renderPharmacy() {
  const el = document.getElementById("pharmacy-detail");
  const loc = normalizeQuartierVille(pharmacy);
  const s = pharmacy.stats_30j || { VUE: 0, APPEL: 0, RECHERCHE: 0 };
  const imgUrl = pharmacyImageUrl(pharmacy.image);
  const imgBlock = imgUrl
    ? `<img src="${imgUrl}" alt="" class="pharmacy-detail-img" />`
    : "";
  el.innerHTML = `
    <article class="card">
      ${imgBlock}
      <div class="pharmacy-detail-header">
        <div class="pharmacy-detail-title">
          <h1>${escapeHtml(pharmacy.nom)}</h1>
          <div class="pharmacy-detail-badges">${detailHeaderBadges(pharmacy)}</div>
        </div>
        <button type="button" id="btn-garde-main" class="btn btn-garde btn-small">
          ${pharmacy.est_de_garde ? "Gérer la garde" : "Mode de garde"}
        </button>
      </div>
      <p class="muted coords-display">GPS : ${pharmacy.latitude != null ? `${Number(pharmacy.latitude).toFixed(6)}, ${Number(pharmacy.longitude).toFixed(6)}` : "—"}</p>
      <div class="detail-grid">
        <p><strong>Adresse :</strong> ${escapeHtml(pharmacy.adresse)}</p>
        <p><strong>Quartier :</strong> ${escapeHtml(loc.quartier || "—")}</p>
        <p><strong>Ville :</strong> ${escapeHtml(loc.ville || "—")}</p>
        <p><strong>Téléphone :</strong> ${escapeHtml(pharmacy.telephone || "—")}</p>
        <p><strong>Horaires :</strong> ${escapeHtml(pharmacy.heure_ouverture || "—")} – ${escapeHtml(pharmacy.heure_fermeture || "—")}</p>
        <p><strong>État pour les clients :</strong> ${
          typeof pharmacyIsEffectivelyOpen === "function" && pharmacyIsEffectivelyOpen(pharmacy)
            ? pharmacy.est_de_garde
              ? "De garde"
              : "Ouverte"
            : "Fermée"
        } <span class="muted">(selon horaires et garde, pas seulement le bouton ouvert/fermé)</span></p>
        <p><strong>Visible publiquement :</strong> ${pharmacy.est_active ? "Oui" : "Non (validation admin)"}</p>
      </div>
      <div class="stats-grid" style="margin-top:1rem">
        <div class="stat-card"><div class="stat-value">${s.VUE}</div><div class="stat-label">Vues (30j)</div></div>
        <div class="stat-card accent-orange"><div class="stat-value">${s.APPEL}</div><div class="stat-label">Appels</div></div>
        <div class="stat-card accent-blue"><div class="stat-value">${s.RECHERCHE}</div><div class="stat-label">Recherches</div></div>
        <div class="stat-card"><div class="stat-value">${pharmacy.note_moyenne ?? "—"}</div><div class="stat-label">Note (${pharmacy.nb_avis} avis)</div></div>
      </div>
      <div class="detail-actions">
        <button type="button" id="btn-edit-pharmacy" class="btn btn-teal">Modifier</button>
        <button type="button" id="btn-toggle-open" class="btn btn-outline">${pharmacy.est_ouverte ? "Marquer fermée" : "Marquer ouverte"}</button>
        <button type="button" id="btn-delete-pharmacy" class="btn btn-danger">Supprimer la pharmacie</button>
      </div>
    </article>`;

  document.getElementById("btn-edit-pharmacy").addEventListener("click", showEditModal);
  document.getElementById("btn-garde-main").addEventListener("click", openGardeModal);
  document.getElementById("btn-toggle-open").addEventListener("click", () =>
    showToggleModal("est_ouverte", !pharmacy.est_ouverte)
  );
  document.getElementById("btn-delete-pharmacy").addEventListener("click", () =>
    openPharmaModal("modal-delete-pharmacy")
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!initPharmaPage()) return;
  setupModalClose();

  pharmacyId = new URLSearchParams(location.search).get("id");
  if (!pharmacyId) {
    document.getElementById("pharmacy-detail").innerHTML =
      '<p class="error">Pharmacie non spécifiée.</p>';
    return;
  }

  try {
    pharmacy = await MediCareAPI.getPharmaPharmacy(pharmacyId);
    renderPharmacy();
    await loadStock();
  } catch (err) {
    document.getElementById("pharmacy-detail").innerHTML = `<p class="error">${err.message}</p>`;
    return;
  }

  document.getElementById("confirm-toggle").addEventListener("click", async () => {
    if (!pendingToggle) return;
    const body = {};
    body[pendingToggle.field] = pendingToggle.newValue;
    await MediCareAPI.updatePharmaPharmacy(pharmacyId, body);
    closePharmaModal("modal-toggle");
    pendingToggle = null;
    pharmacy = await MediCareAPI.getPharmaPharmacy(pharmacyId);
    renderPharmacy();
  });

  document.getElementById("btn-add-stock").addEventListener("click", () =>
    openPharmaModal("modal-add-stock")
  );

  document.querySelectorAll("[data-stock-statut]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyStockFilter(btn.getAttribute("data-stock-statut") ?? "");
    });
  });

  document.getElementById("stock-list").addEventListener("click", async (e) => {
    const ruptureBtn = e.target.closest("[data-stock-rupture]");
    if (ruptureBtn) {
      await setStockDisponible(ruptureBtn.dataset.stockRupture, false);
      return;
    }
    const dispoBtn = e.target.closest("[data-stock-disponible]");
    if (dispoBtn) {
      openEditStockModal(dispoBtn.dataset.stockDisponible, { remettreDisponible: true });
      return;
    }
    const editBtn = e.target.closest("[data-edit-stock]");
    if (editBtn) {
      openEditStockModal(editBtn.dataset.editStock);
      return;
    }
    const delBtn = e.target.closest("[data-del-stock]");
    if (delBtn) {
      openDeleteStockModal(delBtn.dataset.delStock);
    }
  });

  document.getElementById("confirm-delete-pharmacy").addEventListener("click", async () => {
    await MediCareAPI.deletePharmaPharmacy(pharmacyId);
    window.location.href = "pharmacie.html";
  });

  document.getElementById("form-add-stock").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    await MediCareAPI.addPharmaStock(pharmacyId, {
      nom: f.nom.value.trim(),
      description: f.description.value.trim() || null,
      prix: f.prix.value ? parseFloat(f.prix.value) : null,
      quantite: 1,
    });
    closePharmaModal("modal-add-stock");
    f.reset();
    loadStock();
  });

  document.getElementById("confirm-delete-stock").addEventListener("click", async () => {
    if (!deleteStockId) return;
    await MediCareAPI.deletePharmaStock(deleteStockId);
    closePharmaModal("modal-delete-stock");
    deleteStockId = null;
    loadStock();
  });
});
