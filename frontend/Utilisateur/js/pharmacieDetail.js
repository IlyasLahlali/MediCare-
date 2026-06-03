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

function updateStockSection(stock, stockEl, stockCountEl, stockSummaryEl) {
  const stockNotice =
    stock._offlineCache && typeof medicareOfflineNoticeHtml === "function"
      ? medicareOfflineNoticeHtml()
      : "";

  stockEl.innerHTML = stockNotice + renderPharmacyStockGrid(stock);

  if (stock.length) {
    stockCountEl.hidden = false;
    stockCountEl.textContent = `${stock.length} médicament${stock.length > 1 ? "s" : ""}`;
    stockSummaryEl.textContent = "Disponibilités actuelles dans cette officine.";
  } else {
    stockCountEl.hidden = true;
    stockSummaryEl.textContent = "Aucune disponibilité publiée pour le moment.";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!initUtilisateurPage()) return;

  const id = new URLSearchParams(location.search).get("id");
  const detailEl = document.getElementById("pharmacy-detail");
  const stockEl = document.getElementById("stock-list");
  const stockCountEl = document.getElementById("stock-count");
  const stockSummaryEl = document.getElementById("stock-summary");

  if (!id) {
    detailEl.innerHTML = '<p class="error">Pharmacie non spécifiée.</p>';
    return;
  }

  const lat = new URLSearchParams(location.search).get("lat");
  const lon = new URLSearchParams(location.search).get("lon");
  const geoParams = lat && lon ? { lat, lon } : {};
  const geoQuery = lat && lon ? `&lat=${lat}&lon=${lon}` : "";

  let estFavori = false;

  async function refreshFavoriButton(btn) {
    const data = await MediCareAPI.checkFavori(id);
    estFavori = data.est_favori;
    btn.textContent = estFavori ? "★ Retirer des favoris" : "☆ Ajouter aux favoris";
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

    const stock = await MediCareAPI.getStock(id);
    updateStockSection(stock, stockEl, stockCountEl, stockSummaryEl);

    await loadAvisSection(id);
  } catch (err) {
    detailEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    stockEl.innerHTML = "";
  }

  document.getElementById("search-med-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("med-q").value.trim();
    if (q.length < 2) return;
    const onlyHere = document.getElementById("med-this-pharmacy")?.checked;
    window.location.href = medicamentSearchResultsUrl("utilisateur", q, onlyHere ? id : undefined);
  });

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
