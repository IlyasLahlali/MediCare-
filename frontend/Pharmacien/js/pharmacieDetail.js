let pharmacyId = null;
let pharmacy = null;
let pendingToggle = null;
let stockCache = [];
let currentStockFilter = "";
let stockSearchQuery = "";
let importPreviewItems = [];
let stockMedsListVisible = true;

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
    const data = await MediCareAPI.getAvisPharmacie(pharmacyId);
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

async function loadStock() {
  const el = document.getElementById("stock-list");
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
  if (p.est_de_garde && !p.est_active) {
    badges += ' <span class="badge badge-garde">De garde</span>';
  }
  return badges;
}

function pdClientState(ph) {
  if (typeof pharmacyIsEffectivelyOpen === "function" && pharmacyIsEffectivelyOpen(ph)) {
    return ph.est_de_garde ? "De garde" : "Ouverte";
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
      <div class="pd-hero__media">
        <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(altName)}" />
        <div class="pd-hero__overlay" aria-hidden="true"></div>
      </div>`;
  }
  return `
    <div class="pd-hero__media pd-hero__media--placeholder" aria-hidden="true">
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
          <p class="pd-status-tile__hint">Horaires, garde et bouton ouvert/fermé</p>
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
          <p class="pd-status-tile__hint">${ph.est_ouverte ? "Marquée ouverte" : "Marquée fermée"}</p>
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
          <p class="pd-status-tile__hint">${ph.est_active ? "Visible sur la carte publique" : "Masquée jusqu'à validation"}</p>
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

async function renderPharmacy() {
  const el = document.getElementById("pharmacy-detail");
  const loc = normalizeQuartierVille(pharmacy);
  const s = pharmacy.stats_30j || { VUE: 0, APPEL: 0, RECHERCHE: 0 };
  const imgUrl = pharmacyImageUrl(pharmacy.image);
  const gps =
    pharmacy.latitude != null && pharmacy.longitude != null
      ? `${Number(pharmacy.latitude).toFixed(6)}, ${Number(pharmacy.longitude).toFixed(6)}`
      : "Non renseigné";

  const crumb = document.getElementById("pd-breadcrumb-name");
  if (crumb) crumb.textContent = pharmacy.nom;

  document.title = `${pharmacy.nom} — MediCare+ Pro`;

  el.innerHTML = `
    <div class="pd-page">
      <article class="pd-hero">
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
            </div>
          </div>
          <div class="pd-hero__toolbar" aria-label="Gestion de la pharmacie">
            <button type="button" id="btn-edit-pharmacy" class="btn btn-teal btn-small">Modifier la pharmacie</button>
            <button type="button" id="btn-toggle-open" class="btn btn-outline btn-small">
              ${pharmacy.est_ouverte ? "Marquer fermée" : "Marquer ouverte"}
            </button>
            <button type="button" id="btn-delete-pharmacy" class="btn btn-danger btn-small">Supprimer</button>
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
              <p class="pd-info-card__value">${escapeHtml(pharmacy.heure_ouverture || "—")} – ${escapeHtml(pharmacy.heure_fermeture || "—")}</p>
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

  document.getElementById("btn-edit-pharmacy").addEventListener("click", showEditModal);
  document.getElementById("btn-garde-main").addEventListener("click", openGardeModal);
  document.getElementById("btn-toggle-open").addEventListener("click", () =>
    showToggleModal("est_ouverte", !pharmacy.est_ouverte)
  );
  document.getElementById("btn-delete-pharmacy").addEventListener("click", () =>
    openPharmaModal("modal-delete-pharmacy")
  );
  mountStockSection();
  mountAvisSection();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!initPharmaPage()) return;
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
    await loadStock();
    await loadPharmaAvis();
  } catch (err) {
    document.getElementById("pharmacy-detail").innerHTML = `<p class="pd-error">${escapeHtml(err.message)}</p>`;
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
    await MediCareAPI.deletePharmaPharmacy(pharmacyId);
    window.location.href = "pharmacie.html";
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
