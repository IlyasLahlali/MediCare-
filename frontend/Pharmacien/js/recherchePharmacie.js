let deletePharmacyId = null;
let editStockId = null;

function pharmacyEditFormHtml(p) {
  return `
    <input type="hidden" name="id" value="${p.id}" />
    <label>Nom <input type="text" name="nom" value="${escapeHtml(p.nom)}" required /></label>
    <label>Adresse <textarea name="adresse" rows="2" required>${escapeHtml(p.adresse)}</textarea></label>
    <div class="form-grid-2">
      <label>Quartier <input type="text" name="quartier" value="${escapeHtml(p.quartier || "")}" /></label>
      <label>Ville <input type="text" name="ville" value="${escapeHtml(p.ville || "")}" /></label>
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
    <label><input type="checkbox" name="est_de_garde" ${p.est_de_garde ? "checked" : ""} /> De garde</label>
    <div class="pharma-modal-footer">
      <button type="button" class="btn btn-outline" data-close-modal="modal-edit-pharmacy">Annuler</button>
      <button type="submit" class="btn btn-teal">Enregistrer</button>
    </div>`;
}

async function loadPharmacies(q) {
  const el = document.getElementById("pharmacies-results");
  el.innerHTML = '<p class="muted">Chargement…</p>';
  try {
    const list = await MediCareAPI.getPharmaPharmacies(q);
    if (!list.length) {
      el.innerHTML = "<p class=\"muted\">Aucune pharmacie trouvée.</p>";
      return;
    }
    el.className = "pharmacy-list";
    el.innerHTML = list
      .map((p) =>
        renderPharmacyCard(p, {
          relativeUrl: true,
          badgesExtra: pharmaPendingBadgeHtml(p),
          metaExtra: pharmaGardePlanningMeta(p),
          actionsHtml: pharmaRechercheCardActions(p),
        })
      )
      .join("");

    el.querySelectorAll("[data-edit-pharmacy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const p = await MediCareAPI.getPharmaPharmacy(btn.dataset.editPharmacy);
        const form = document.getElementById("form-edit-pharmacy");
        form.innerHTML = pharmacyEditFormHtml(p);
        form.onsubmit = async (ev) => {
          ev.preventDefault();
          const fd = new FormData(form);
          await MediCareAPI.updatePharmaPharmacy(p.id, {
            nom: fd.get("nom"),
            adresse: fd.get("adresse"),
            quartier: fd.get("quartier") || null,
            ville: fd.get("ville") || null,
            telephone: fd.get("telephone") || null,
            heure_ouverture: fd.get("heure_ouverture") || null,
            heure_fermeture: fd.get("heure_fermeture") || null,
            latitude: fd.get("latitude") ? parseFloat(fd.get("latitude")) : null,
            longitude: fd.get("longitude") ? parseFloat(fd.get("longitude")) : null,
            est_ouverte: !!form.est_ouverte.checked,
            est_de_garde: !!form.est_de_garde.checked,
          });
          closePharmaModal("modal-edit-pharmacy");
          loadPharmacies(document.getElementById("search-q").value.trim());
        };
        openPharmaModal("modal-edit-pharmacy");
      });
    });

    el.querySelectorAll("[data-delete-pharmacy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        deletePharmacyId = btn.dataset.deletePharmacy;
        document.getElementById("delete-pharmacy-text").textContent =
          `Supprimer « ${btn.dataset.name} » ?`;
        openPharmaModal("modal-delete-pharmacy");
      });
    });
  } catch (err) {
    el.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!initPharmaPage()) return;
  setupModalClose();

  const qParam = new URLSearchParams(location.search).get("q") || "";
  if (qParam) document.getElementById("search-q").value = qParam;
  loadPharmacies(qParam);

  document.getElementById("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("search-q").value.trim();
    history.replaceState(null, "", q ? `?q=${encodeURIComponent(q)}` : location.pathname);
    loadPharmacies(q);
  });

  document.getElementById("confirm-delete-pharmacy").addEventListener("click", async () => {
    if (!deletePharmacyId) return;
    await MediCareAPI.deletePharmaPharmacy(deletePharmacyId);
    closePharmaModal("modal-delete-pharmacy");
    deletePharmacyId = null;
    loadPharmacies(document.getElementById("search-q").value.trim());
  });

  document.getElementById("med-search-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = document.getElementById("med-search-q").value.trim();
    const el = document.getElementById("med-results");
    if (q.length < 2) {
      el.innerHTML = "<p class=\"muted\">2 caractères minimum.</p>";
      return;
    }
    try {
      const meds = await MediCareAPI.searchMedicamentsCatalog(q);
      el.innerHTML = meds.length
        ? `<table class="pharma-table"><thead><tr><th>Médicament</th><th>Prix</th></tr></thead><tbody>
          ${meds.map((m) => `<tr><td>${escapeHtml(m.nom)}</td><td>${m.prix != null ? m.prix + " DH" : "—"}</td></tr>`).join("")}
          </tbody></table><p class="muted">Pour modifier le stock, ouvrez le détail d'une pharmacie.</p>`
        : "<p class=\"muted\">Aucun médicament dans le catalogue.</p>";
    } catch (err) {
      el.innerHTML = `<p class="error">${err.message}</p>`;
    }
  });
});
