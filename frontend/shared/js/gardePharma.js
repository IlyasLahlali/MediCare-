/**
 * Modal mode de garde — partagé Dashboard / pharmacie / détail.
 */
const GardePharma = (() => {
  let onSuccessCallback = null;

  function toDatetimeLocalValue(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function defaultFin() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }

  function ensureModal() {
    if (!document.getElementById("modal-garde")) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `
    <div id="modal-garde" class="pharma-modal hidden">
      <div class="pharma-modal-panel wide">
        <header>
          <h2 id="garde-modal-title">Mode de garde</h2>
          <button type="button" class="btn btn-small btn-outline" data-close-modal="modal-garde">✕</button>
        </header>
        <p id="garde-modal-pharmacy" class="muted"></p>
        <div id="garde-status-box" class="garde-status-box"></div>
        <form id="form-garde" class="garde-form-fields">
          <input type="hidden" id="garde-pharmacy-id" />
          <label>Début de garde
            <input type="datetime-local" id="garde-date-debut" required />
          </label>
          <label>Fin de garde
            <input type="datetime-local" id="garde-date-fin" required />
          </label>
          <p id="garde-form-hint" class="muted garde-hint">
            Pendant cette période, la pharmacie est signalée « de garde » sur la carte et dans les recherches.
          </p>
          <p id="garde-form-msg" class="muted"></p>
          <div class="pharma-modal-footer garde-modal-footer">
            <button type="button" id="btn-garde-deactivate" class="btn btn-danger hidden">
              Annuler la garde
            </button>
            <button type="button" class="btn btn-outline" data-close-modal="modal-garde">Fermer</button>
            <button type="submit" id="btn-garde-save" class="btn btn-garde">Activer le mode de garde</button>
          </div>
        </form>
      </div>
    </div>`
      );

      document.getElementById("form-garde").addEventListener("submit", async (e) => {
        e.preventDefault();
        await submitSave();
      });

      document.getElementById("btn-garde-deactivate").addEventListener("click", () => {
        openConfirmDeactivate();
      });

      document.querySelectorAll("[data-close-modal='modal-garde']").forEach((btn) => {
        btn.addEventListener("click", () => closePharmaModal("modal-garde"));
      });
      document.getElementById("modal-garde")?.addEventListener("click", (e) => {
        if (e.target.id === "modal-garde") closePharmaModal("modal-garde");
      });
    }

    if (!document.getElementById("modal-garde-confirm")) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `
    <div id="modal-garde-confirm" class="pharma-modal pharma-modal--confirm hidden">
      <div class="pharma-modal-panel">
        <header>
          <h2>Annuler la garde</h2>
          <button type="button" class="btn btn-small btn-outline" data-close-modal="modal-garde-confirm">✕</button>
        </header>
        <p id="garde-confirm-text"></p>
        <div class="pharma-modal-footer">
          <button type="button" class="btn btn-outline" data-close-modal="modal-garde-confirm">Non</button>
          <button type="button" id="btn-garde-confirm-yes" class="btn btn-danger">Oui</button>
        </div>
      </div>
    </div>`
      );

      document.getElementById("btn-garde-confirm-yes").addEventListener("click", () => {
        runDeactivate();
      });
      document.querySelectorAll("[data-close-modal='modal-garde-confirm']").forEach((btn) => {
        btn.addEventListener("click", () => closePharmaModal("modal-garde-confirm"));
      });
      document.getElementById("modal-garde-confirm")?.addEventListener("click", (e) => {
        if (e.target.id === "modal-garde-confirm") closePharmaModal("modal-garde-confirm");
      });
    }
  }

  function openConfirmDeactivate() {
    const label = document.getElementById("garde-modal-pharmacy").textContent || "";
    const name = label.replace(/^Pharmacie\s*:\s*/i, "").trim() || "cette pharmacie";
    document.getElementById("garde-confirm-text").textContent =
      `Confirmez-vous l'annulation de la garde pour ${name} ? Elle ne sera plus affichée comme « de garde » sur MediCare+.`;
    openPharmaModal("modal-garde-confirm");
  }

  function applyDatesToInputs(planning) {
    if (planning?.date_debut) {
      document.getElementById("garde-date-debut").value = toDatetimeLocalValue(planning.date_debut);
    }
    if (planning?.date_fin) {
      document.getElementById("garde-date-fin").value = toDatetimeLocalValue(planning.date_fin);
    }
  }

  function isGardeInProgress(planning) {
    if (!planning?.date_debut || !planning?.date_fin) return false;
    const now = Date.now();
    return (
      now >= new Date(planning.date_debut).getTime() &&
      now <= new Date(planning.date_fin).getTime()
    );
  }

  function renderStatus(pharmacy, planning) {
    const box = document.getElementById("garde-status-box");
    const btnOff = document.getElementById("btn-garde-deactivate");
    const btnSave = document.getElementById("btn-garde-save");
    const hint = document.getElementById("garde-form-hint");

    const fin = planning?.date_fin
      ? new Date(planning.date_fin).toLocaleString("fr-MA")
      : "—";
    const debut = planning?.date_debut
      ? new Date(planning.date_debut).toLocaleString("fr-MA")
      : "—";
    const inProgress = isGardeInProgress(planning);
    const scheduled =
      planning?.date_debut && new Date(planning.date_debut).getTime() > Date.now();

    if (inProgress) {
      box.innerHTML = `
        <div class="garde-active-banner">
          <span class="badge badge-garde">De garde — visible clients</span>
          <p>Du <strong>${escapeHtml(debut)}</strong> au <strong>${escapeHtml(fin)}</strong></p>
        </div>`;
      btnOff.classList.remove("hidden");
      btnSave.textContent = "Enregistrer";
      hint.textContent =
        "Modifiez les dates ci-dessous puis cliquez sur Enregistrer pour mettre à jour la période.";
    } else if (scheduled) {
      box.innerHTML = `
        <div class="garde-active-banner" style="background:#fffbeb">
          <span class="badge badge-pending">Garde programmée</span>
          <p>Du <strong>${escapeHtml(debut)}</strong> au <strong>${escapeHtml(fin)}</strong></p>
          <p class="muted" style="margin:0.35rem 0 0;font-size:0.88rem">Visible pour les clients à partir du début de la période.</p>
        </div>`;
      btnOff.classList.remove("hidden");
      btnSave.textContent = "Enregistrer";
      hint.textContent = "La pharmacie apparaîtra « de garde » automatiquement au début de la période.";
    } else if (planning) {
      box.innerHTML = `<p class="muted">Période de garde terminée. Vous pouvez en définir une nouvelle ci-dessous.</p>`;
      btnOff.classList.add("hidden");
      btnSave.textContent = "Activer le mode de garde";
      hint.textContent =
        "Pendant la période choisie, la pharmacie est signalée « de garde » sur la carte et dans les recherches.";
    } else {
      box.innerHTML = `<p class="muted">Cette pharmacie n'est pas en mode de garde pour le moment.</p>`;
      btnOff.classList.add("hidden");
      btnSave.textContent = "Activer le mode de garde";
      hint.textContent =
        "Pendant la période choisie, la pharmacie est signalée « de garde » sur la carte et dans les recherches.";
    }
  }

  async function refreshModalState(pharmacyId) {
    let pharmacy = { est_de_garde: false };
    let planning = null;
    try {
      const detail = await MediCareAPI.getPharmaPharmacy(pharmacyId);
      pharmacy = detail;
      planning = detail.planning_garde;
    } catch {
      const list = await MediCareAPI.getGardeSummary();
      const row = list.find((p) => String(p.id) === String(pharmacyId));
      if (row) {
        pharmacy = row;
        planning = row.planning;
      }
    }
    applyDatesToInputs(planning);
    renderStatus(pharmacy, planning);
    return { pharmacy, planning };
  }

  async function submitSave() {
    const id = document.getElementById("garde-pharmacy-id").value;
    const msg = document.getElementById("garde-form-msg");
    const btnSave = document.getElementById("btn-garde-save");
    const debut = document.getElementById("garde-date-debut").value;
    const fin = document.getElementById("garde-date-fin").value;

    if (!debut || !fin) {
      msg.textContent = "Indiquez une date de début et de fin.";
      msg.className = "error";
      return;
    }
    if (new Date(fin) <= new Date(debut)) {
      msg.textContent = "La date de fin doit être après la date de début.";
      msg.className = "error";
      return;
    }

    msg.textContent = "";
    btnSave.disabled = true;
    try {
      const data = await MediCareAPI.activateGarde(id, {
        date_debut: debut,
        date_fin: fin,
      });
      msg.textContent = data.message || "Période enregistrée.";
      msg.className = "success-msg";
      if (window.NotificationCenter) {
        await NotificationCenter.refreshSummary();
        NotificationCenter.showToast({
          type: "GARDE",
          titre: "Mode de garde activé",
          message: data.message || "Votre pharmacie est en mode de garde.",
        });
      }
      if (onSuccessCallback) await onSuccessCallback();
      closePharmaModal("modal-garde");
    } catch (err) {
      msg.textContent = err.message;
      msg.className = "error";
    } finally {
      btnSave.disabled = false;
    }
  }

  async function runDeactivate() {
    const id = document.getElementById("garde-pharmacy-id").value;
    const msg = document.getElementById("garde-form-msg");
    const btnYes = document.getElementById("btn-garde-confirm-yes");
    closePharmaModal("modal-garde-confirm");
    btnYes.disabled = true;
    try {
      const data = await MediCareAPI.deactivateGarde(id);
      msg.textContent = data.message || "Garde annulée.";
      msg.className = "success-msg";
      if (window.NotificationCenter) {
        await NotificationCenter.refreshSummary();
        NotificationCenter.showToast({
          type: "GARDE",
          titre: "Garde terminée",
          message: "La garde n’est plus active sur MediCare+.",
        });
      }
      document.getElementById("garde-date-debut").value = toDatetimeLocalValue(new Date());
      if (onSuccessCallback) await onSuccessCallback();
      closePharmaModal("modal-garde");
    } catch (err) {
      msg.textContent = err.message;
      msg.className = "error";
    } finally {
      btnYes.disabled = false;
    }
  }

  async function openForPharmacy(pharmacyId, pharmacyName, options = {}) {
    ensureModal();
    onSuccessCallback = options.onSuccess || null;

    document.getElementById("garde-pharmacy-id").value = pharmacyId;
    document.getElementById("garde-modal-pharmacy").textContent = `Pharmacie : ${pharmacyName}`;
    document.getElementById("garde-date-debut").value = toDatetimeLocalValue(new Date());
    document.getElementById("garde-date-fin").value = toDatetimeLocalValue(defaultFin());
    document.getElementById("garde-form-msg").textContent = "";

    await refreshModalState(pharmacyId);
    openPharmaModal("modal-garde");
  }

  return { openForPharmacy, ensureModal };
})();

window.GardePharma = GardePharma;
