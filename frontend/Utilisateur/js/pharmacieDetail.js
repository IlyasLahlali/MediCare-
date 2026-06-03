function bindStarRating(containerEl, hiddenInputEl, initial = 0) {
  if (!containerEl || !hiddenInputEl) return { getValue: () => 0, setValue: () => {} };

  let selected = initial;

  const render = () => {
    containerEl.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "★";
      btn.className = i <= selected ? "active" : "";
      btn.setAttribute("aria-label", `${i} étoile${i > 1 ? "s" : ""}`);
      btn.addEventListener("click", () => {
        selected = i;
        hiddenInputEl.value = String(i);
        render();
      });
      containerEl.appendChild(btn);
    }
  };

  hiddenInputEl.value = String(initial || 0);
  render();

  return {
    getValue: () => selected,
    setValue: (v) => {
      selected = Number(v) || 0;
      hiddenInputEl.value = String(selected);
      render();
    },
  };
}

function openUserAvisModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("user-avis-modal-open");
}

function closeUserAvisModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".user-avis-modal:not([hidden])")) {
    document.body.classList.remove("user-avis-modal-open");
  }
}

async function refreshAvisNotifications() {
  if (window.NotificationCenter?.refresh) {
    await NotificationCenter.refresh();
  } else if (window.NotificationCenter?.refreshSummary) {
    await NotificationCenter.refreshSummary();
  }
}

function showAvisError(message, msgEl) {
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.className = "error";
  }
  if (window.NotificationCenter?.showToast) {
    NotificationCenter.showToast({ type: "ALERT", titre: "Erreur", message });
  }
}

function initAvisModals() {
  document.querySelectorAll("[data-close-avis-modal]").forEach((el) => {
    el.addEventListener("click", () => closeUserAvisModal(el.dataset.closeAvisModal));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    ["avis-edit-modal", "avis-delete-modal"].forEach((id) => {
      const m = document.getElementById(id);
      if (m && !m.hidden) closeUserAvisModal(id);
    });
  });
}

function setAvisAddButtonVisible(visible) {
  const trigger = document.getElementById("avis-add-trigger");
  if (trigger) trigger.hidden = !visible;
}

function showAvisForm(show) {
  const wrap = document.getElementById("avis-form-wrap");
  if (!wrap) return;
  wrap.hidden = !show;
  if (show) setAvisAddButtonVisible(false);
}

function renderAvisCard(a, { isMine = false } = {}) {
  const stars = `${"★".repeat(a.note)}${"☆".repeat(5 - a.note)}`;
  const actions = isMine
    ? `<div class="pharmacy-detail-avis-card__actions">
        <button type="button" class="btn btn-outline btn-small btn-avis-edit" data-avis-edit="${a.id}">Modifier</button>
        <button type="button" class="btn btn-outline btn-small btn-avis-delete" data-avis-delete="${a.id}">Supprimer</button>
      </div>`
    : "";

  return `
    <article class="pharmacy-detail-avis-card${isMine ? " pharmacy-detail-avis-card--mine" : ""}" data-avis-id="${a.id}">
      <div class="pharmacy-detail-avis-card__head">
        <div class="pharmacy-detail-avis-card__who">
          <span class="pharmacy-detail-avis-card__name">${escapeHtml(a.nom_utilisateur)}</span>
          ${isMine ? '<span class="pharmacy-detail-avis-card__badge">Votre avis</span>' : ""}
        </div>
        <span class="pharmacy-detail-avis-stars" aria-label="Note ${a.note} sur 5">${stars}</span>
      </div>
      ${a.commentaire ? `<p class="pharmacy-detail-avis-card__text">${escapeHtml(a.commentaire)}</p>` : ""}
      <p class="pharmacy-detail-avis-date">${new Date(a.date_creation).toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" })}</p>
      ${actions}
    </article>`;
}

let avisFormStars = null;
let avisEditStars = null;

async function loadAvisSection(pharmacyId) {
  const summaryEl = document.getElementById("rating-summary");
  const listEl = document.getElementById("avis-list");
  const [data, monAvis] = await Promise.all([
    MediCareAPI.getAvisPharmacie(pharmacyId),
    MediCareAPI.getMonAvis(pharmacyId),
  ]);

  const nb = Number(data.nb_avis) || 0;
  summaryEl.textContent =
    nb > 0
      ? `Note moyenne : ${data.note_moyenne} / 5 (${nb} avis)`
      : "Aucun avis pour le moment — soyez le premier !";

  const sorted = [...(data.avis || [])].sort((a, b) => {
    if (monAvis && a.id === monAvis.id) return -1;
    if (monAvis && b.id === monAvis.id) return 1;
    return new Date(b.date_creation) - new Date(a.date_creation);
  });

  listEl.innerHTML = sorted.length
    ? sorted.map((a) => renderAvisCard(a, { isMine: monAvis && a.id === monAvis.id })).join("")
    : "";

  if (monAvis) {
    showAvisForm(false);
    setAvisAddButtonVisible(false);
  } else {
    showAvisForm(false);
    setAvisAddButtonVisible(true);
    const noteEl = document.getElementById("avis-note");
    const commentEl = document.getElementById("avis-commentaire");
    if (commentEl) commentEl.value = "";
    if (avisFormStars) avisFormStars.setValue(0);
    else if (noteEl) noteEl.value = "0";
  }
}

function initAvisSection(pharmacyId) {
  initAvisModals();

  const formWrap = document.getElementById("avis-form-wrap");
  const addBtn = document.getElementById("btn-avis-add");
  const cancelBtn = document.getElementById("btn-avis-cancel");
  const form = document.getElementById("avis-form");
  const editForm = document.getElementById("avis-edit-form");
  const deleteConfirm = document.getElementById("btn-avis-delete-confirm");

  avisFormStars = bindStarRating(
    document.getElementById("star-rating"),
    document.getElementById("avis-note"),
    0
  );
  avisEditStars = bindStarRating(
    document.getElementById("star-rating-edit"),
    document.getElementById("avis-note-edit"),
    0
  );

  addBtn?.addEventListener("click", () => {
    document.getElementById("avis-msg").textContent = "";
    document.getElementById("avis-msg").className = "muted";
    avisFormStars.setValue(0);
    document.getElementById("avis-commentaire").value = "";
    showAvisForm(true);
    document.getElementById("avis-commentaire")?.focus();
  });

  cancelBtn?.addEventListener("click", async () => {
    showAvisForm(false);
    document.getElementById("avis-msg").textContent = "";
    const mon = await MediCareAPI.getMonAvis(pharmacyId);
    setAvisAddButtonVisible(!mon);
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("avis-msg");
    const note = avisFormStars.getValue();
    if (!note || note < 1) {
      showAvisError("Choisissez une note entre 1 et 5.", msg);
      return;
    }
    try {
      await MediCareAPI.postAvis(
        pharmacyId,
        note,
        document.getElementById("avis-commentaire").value.trim()
      );
      msg.textContent = "";
      msg.className = "muted";
      showAvisForm(false);
      await loadAvisSection(pharmacyId);
      await refreshAvisNotifications();
    } catch (err) {
      showAvisError(err.message, msg);
    }
  });

  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("avis-edit-msg");
    const note = avisEditStars.getValue();
    if (!note || note < 1) {
      showAvisError("Choisissez une note entre 1 et 5.", msg);
      return;
    }
    try {
      await MediCareAPI.updateAvis(
        pharmacyId,
        note,
        document.getElementById("avis-commentaire-edit").value.trim()
      );
      closeUserAvisModal("avis-edit-modal");
      await loadAvisSection(pharmacyId);
      await refreshAvisNotifications();
    } catch (err) {
      showAvisError(err.message, msg);
    }
  });

  deleteConfirm?.addEventListener("click", async () => {
    try {
      await MediCareAPI.deleteAvis(pharmacyId);
      closeUserAvisModal("avis-delete-modal");
      await loadAvisSection(pharmacyId);
      await refreshAvisNotifications();
    } catch (err) {
      showAvisError(err.message);
    }
  });

  document.getElementById("avis-list")?.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-avis-edit]");
    const delBtn = e.target.closest("[data-avis-delete]");
    if (!editBtn && !delBtn) return;

    if (editBtn) {
      const mon = await MediCareAPI.getMonAvis(pharmacyId);
      if (!mon) return;
      document.getElementById("avis-edit-msg").textContent = "";
      document.getElementById("avis-edit-msg").className = "muted";
      avisEditStars.setValue(mon.note);
      document.getElementById("avis-commentaire-edit").value = mon.commentaire || "";
      openUserAvisModal("avis-edit-modal");
      return;
    }

    if (delBtn) {
      openUserAvisModal("avis-delete-modal");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initPharmacyDetailPhotoZoom();

  if (!initUtilisateurPage()) return;

  const id = new URLSearchParams(location.search).get("id");
  const detailEl = document.getElementById("pharmacy-detail");

  if (!id) {
    detailEl.innerHTML = '<p class="error">Pharmacie non spécifiée.</p>';
    return;
  }

  const lat = new URLSearchParams(location.search).get("lat");
  const lon = new URLSearchParams(location.search).get("lon");
  const geoParams = lat && lon ? { lat, lon } : {};
  const geoQuery = lat && lon ? `&lat=${lat}&lon=${lon}` : "";

  let estFavori = false;
  const stockCtrl = initPharmacyDetailStock({ zone: "utilisateur", pharmacyId: id });
  const stockPromise = stockCtrl.load();

  initAvisSection(id);

  async function refreshFavoriButton(btn) {
    const data = await MediCareAPI.checkFavori(id);
    estFavori = data.est_favori;
    btn.classList.toggle("is-favori", estFavori);
    btn.setAttribute("aria-pressed", estFavori ? "true" : "false");
    const label = estFavori ? "Retirer des favoris" : "Ajouter aux favoris";
    btn.setAttribute("aria-label", label);
    btn.title = label;
  }

  try {
    const p = await MediCareAPI.getPharmacy(id, geoParams);
    const offlineNotice =
      p._offlineCache && typeof medicareOfflineNoticeHtml === "function"
        ? medicareOfflineNoticeHtml()
        : "";
    MediCareAPI.trackStat(id, "VUE").catch(() => {});

    document.title = `${p.nom} — MediCare+`;
    detailEl.innerHTML =
      offlineNotice +
      renderPharmacyDetailHero(p, {
        geoQuery,
        id,
        backHref: "recherchePharmacie.html",
        showFavori: true,
      });
    initPharmacyDetailBackLink("recherchePharmacie.html");
    document.getElementById("pharmacy-detail-unified")?.classList.add("is-ready");

    detailEl.addEventListener("click", (e) => {
      const call = e.target.closest("[data-track-call]");
      if (call) MediCareAPI.trackStat(call.dataset.trackCall, "APPEL").catch(() => {});
    });

    const favBtn = document.getElementById("btn-favori");
    await refreshFavoriButton(favBtn);
    favBtn.addEventListener("click", async () => {
      try {
        const data = await MediCareAPI.toggleFavori(id);
        estFavori = data.est_favori;
        await refreshFavoriButton(favBtn);
      } catch (err) {
        alert(err.message);
      }
    });

    await Promise.all([stockPromise, loadAvisSection(id)]);
  } catch (err) {
    detailEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    const stockEl = document.getElementById("stock-list");
    if (stockEl) stockEl.innerHTML = "";
  }
});
