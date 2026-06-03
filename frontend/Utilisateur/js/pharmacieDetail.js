function setupStarRating(initial = 0) {
  const container = document.getElementById("star-rating");
  const hidden = document.getElementById("avis-note");
  let selected = initial;

  const render = () => {
    container.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "★";
      btn.className = i <= selected ? "active" : "";
      btn.setAttribute("aria-label", `${i} étoile${i > 1 ? "s" : ""}`);
      btn.addEventListener("click", () => {
        selected = i;
        hidden.value = String(i);
        render();
      });
      container.appendChild(btn);
    }
  };

  hidden.value = String(initial || 0);
  render();
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

  async function refreshFavoriButton(btn) {
    const data = await MediCareAPI.checkFavori(id);
    estFavori = data.est_favori;
    btn.textContent = estFavori ? "★ Favori" : "☆ Favoris";
    btn.classList.toggle("active", estFavori);
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

  document.getElementById("avis-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const note = parseInt(document.getElementById("avis-note").value, 10);
    const msg = document.getElementById("avis-msg");
    if (!note || note < 1) {
      msg.textContent = "Choisissez une note entre 1 et 5.";
      msg.className = "error";
      return;
    }
    try {
      await MediCareAPI.postAvis(
        id,
        note,
        document.getElementById("avis-commentaire").value.trim()
      );
      msg.textContent = "Avis enregistré. Merci !";
      msg.className = "muted";
      await loadAvisSection(id);
    } catch (err) {
      msg.textContent = err.message;
      msg.className = "error";
    }
  });
});

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

  if (monAvis) {
    document.getElementById("avis-commentaire").value = monAvis.commentaire || "";
    setupStarRating(monAvis.note);
  } else {
    setupStarRating(0);
  }

  listEl.innerHTML = data.avis.length
    ? `<h3>Avis des utilisateurs</h3>` +
      data.avis
        .map(
          (a) => `
      <article class="pharmacy-detail-avis-card">
        <div class="pharmacy-detail-avis-card__head">
          <span class="pharmacy-detail-avis-card__name">${escapeHtml(a.nom_utilisateur)}</span>
          <span class="pharmacy-detail-avis-stars" aria-label="Note ${a.note} sur 5">${"★".repeat(a.note)}${"☆".repeat(5 - a.note)}</span>
        </div>
        ${a.commentaire ? `<p>${escapeHtml(a.commentaire)}</p>` : ""}
        <p class="pharmacy-detail-avis-date">${new Date(a.date_creation).toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" })}</p>
      </article>`
        )
        .join("")
    : "";
}
