/** Recherche pharmacie : nom, quartier (liste), ville (auto via géoloc). */

async function loadVilleSelect(selectedVille = "") {
  const villeSel = document.getElementById("search-ville");
  if (!villeSel) return;

  try {
    const { villes = [] } = await MediCareAPI.getPharmacyFilters();
    const opts =
      '<option value="">Toutes les villes</option>' +
      villes.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    villeSel.innerHTML = opts;
    if (selectedVille) villeSel.value = selectedVille;
  } catch (err) {
    villeSel.innerHTML = '<option value="">— Erreur —</option>';
    console.error(err);
  }
}

async function loadPharmacyFilterSelects(ville) {
  const quartierSel = document.getElementById("search-quartier");
  if (!quartierSel) return;

  try {
    const { quartiers } = await MediCareAPI.getPharmacyFilters(ville || undefined);
    quartierSel.innerHTML =
      '<option value="">Tous les quartiers</option>' +
      quartiers
        .map((q) => `<option value="${escapeHtml(q)}">${escapeHtml(q)}</option>`)
        .join("");
  } catch (err) {
    quartierSel.innerHTML = '<option value="">— Erreur —</option>';
    console.error(err);
  }
}

function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

function getStoredAutoVille() {
  try {
    return sessionStorage.getItem("autoVille") || "";
  } catch {
    return "";
  }
}

function setStoredAutoVille(ville) {
  try {
    if (ville) sessionStorage.setItem("autoVille", ville);
    else sessionStorage.removeItem("autoVille");
  } catch {
    /* ignore */
  }
}

function updateVilleAutoUI(info, loading = false) {
  const el = document.getElementById("ville-auto-label");
  if (!el) return;

  if (loading) {
    el.textContent = "Détection de votre ville…";
    el.className = "hero-hint muted";
    return;
  }

  const display = info?.ville || info?.label;
  if (display && info?.ville) {
    el.textContent = `Ville détectée : ${display}`;
    el.className = "hero-hint";
    return;
  }
  if (display) {
    el.textContent = `Zone détectée : ${display} (recherche à proximité, sans filtre ville strict)`;
    el.className = "hero-hint";
    return;
  }
  if (info?.hasGeo) {
    if (info?.hasPharmacies === false) {
      el.textContent =
        "Position OK — aucune pharmacie visible en base. Importez DonneesTest.sql et validez le compte pharmacien.";
    } else {
      el.textContent =
        "Position OK — ville non reconnue. Les pharmacies les plus proches s'affichent quand même.";
    }
    el.className = "hero-hint muted";
    return;
  }

  el.textContent =
    "Autorisez la géolocalisation dans le navigateur (icône cadenas dans la barre d'adresse).";
  el.className = "hero-hint muted";
}

async function resolveSearchContext() {
  const geo = await ensureUserGeo();
  let ville = getStoredAutoVille();
  let villeInfo = { hasGeo: !!geo, hasPharmacies: true };

  if (geo) {
    updateVilleAutoUI(null, true);
    try {
      const data = await MediCareAPI.getVilleAuto(geo.lat, geo.lon);
      villeInfo = {
        hasGeo: true,
        hasPharmacies: data.hasPharmacies !== false,
        ville: data.ville,
        label: data.label,
        source: data.source,
      };
      if (data.ville) {
        ville = data.ville;
        setStoredAutoVille(ville);
      } else {
        setStoredAutoVille("");
      }
    } catch (err) {
      console.warn(err);
      villeInfo.error = err.message;
    }
    updateVilleAutoUI(villeInfo);
  } else {
    updateVilleAutoUI(villeInfo);
  }

  await loadVilleSelect(ville);
  await loadPharmacyFilterSelects(ville);
  const villeSel = document.getElementById("search-ville");
  if (villeSel && ville) villeSel.value = ville;
  return { geo, ville };
}

function readPharmacySearchForm() {
  const urlParams = new URLSearchParams(location.search);
  const nom = document.getElementById("search-nom")?.value.trim() || "";
  const urlVille = urlParams.get("ville") || "";
  const selectVille = document.getElementById("search-ville")?.value || "";
  const resolvedVille = selectVille || urlVille || getStoredAutoVille() || "";
  return {
    nom,
    quartier: document.getElementById("search-quartier")?.value || "",
    ville: nom ? selectVille || urlVille : resolvedVille,
  };
}

function fillPharmacySearchForm({ nom, quartier, ville }) {
  const nomEl = document.getElementById("search-nom");
  const quartierEl = document.getElementById("search-quartier");
  const villeEl = document.getElementById("search-ville");
  if (nomEl && nom) nomEl.value = nom;
  if (quartierEl && quartier) quartierEl.value = quartier;
  if (villeEl && ville) villeEl.value = ville;
}

function pharmacySearchToParams(form, geo) {
  const params = new URLSearchParams();
  if (form.nom) params.set("nom", form.nom);
  if (form.quartier) params.set("quartier", form.quartier);
  if (form.ville && !form.nom) params.set("ville", form.ville);
  if (geo) {
    params.set("lat", geo.lat);
    params.set("lon", geo.lon);
  }
  return params;
}

function pharmacySearchSummary(form, hasGeo) {
  const bits = [];
  if (form.nom) bits.push(`nom « ${form.nom} »`);
  if (form.quartier) bits.push(`quartier ${form.quartier}`);
  if (form.ville) bits.push(`ville ${form.ville}`);
  if (!bits.length) {
    return hasGeo ? "Pharmacies proches de vous" : "Toutes les pharmacies disponibles";
  }
  return `Recherche : ${bits.join(", ")}${hasGeo ? " — tri par proximité" : ""}`;
}

function apiParamsFromSearch(form, geo, ouvertes = false) {
  const p = { ouvertes };
  if (form.nom) p.nom = form.nom;
  if (form.quartier) p.quartier = form.quartier;
  if (form.ville && !form.nom) p.ville = form.ville;
  if (geo) {
    p.lat = geo.lat;
    p.lon = geo.lon;
  }
  return p;
}
