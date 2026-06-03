/**
 * Carte Leaflet des pharmacies — Public & Utilisateur.
 * PharmacyMap.init({ zone: 'public' | 'utilisateur', enableFavoris: boolean })
 */
const PharmacyMap = (() => {
  const DEFAULT_CENTER = [33.5731, -7.5898];
  const DEFAULT_ZOOM = 12;

  let map = null;
  let markersLayer = null;
  let userMarker = null;
  let currentFilter = "all";
  let favoriIds = new Set();
  let lastGeo = null;
  let zone = "public";
  let enableFavoris = false;
  const markerById = new Map();

  function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text ?? "";
    return d.innerHTML;
  }

  function detailPath() {
    return zone === "utilisateur"
      ? "Utilisateur/html/pharmacieDetail.html"
      : "Public/html/pharmacieDetail.html";
  }

  function setStatus(msg, isError = false) {
    const el = document.getElementById("map-status");
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? "#b91c1c" : "#64748b";
  }

  function markerClass(p) {
    if (enableFavoris && favoriIds.has(p.id)) return "marker-favori";
    if (p.est_de_garde) return "marker-garde";
    if (p.est_ouverte) return "marker-open";
    return "marker-closed";
  }

  function createPharmacyIcon(p) {
    return L.divIcon({
      className: "",
      html: `<div class="map-marker ${markerClass(p)}"><div class="map-marker-inner"></div></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    });
  }

  function createUserIcon() {
    return L.divIcon({
      className: "",
      html: '<div class="map-marker marker-user"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }

  function popupHtml(p, geo) {
    const geoQ = geo && geo.lat != null ? `&lat=${geo.lat}&lon=${geo.lon}` : "";
    const detailUrl = pageUrl(`${detailPath()}?id=${p.id}${geoQ}`);
    const dist =
      p.distance_km != null
        ? `<p class="muted">À ${formatDistance(Number(p.distance_km))}</p>`
        : "";
    return `
      <h3>${escapeHtml(p.nom)}</h3>
      <p class="popup-badges">${pharmacyBadges(p)}</p>
      ${dist}
      <p class="muted">${escapeHtml(formatQuartierVille(p) !== "—" ? formatQuartierVille(p) : p.adresse)}</p>
      <p class="muted"><span class="pharmacy-hours-label">Horaires</span> ${escapeHtml(formatPharmacyHours(p.heure_ouverture, p.heure_fermeture))}</p>
      ${
        p.est_de_garde
          ? `<p class="muted pharmacy-garde-hours">Garde : ${escapeHtml(
              formatGardePlanningRange(p.garde_date_debut, p.garde_date_fin) || "en cours"
            )}</p>`
          : ""
      }
      <div class="popup-actions">
        <a href="${detailUrl}" class="btn btn-teal btn-small">Détails</a>
        ${pharmacyDirectionsButtonHtml(p, { geo })}
      </div>`;
  }

  function placeUserMarker(geo) {
    if (!geo || !map) return;
    const latlng = [geo.lat, geo.lon];
    if (userMarker) {
      userMarker.setLatLng(latlng);
    } else {
      userMarker = L.marker(latlng, {
        icon: createUserIcon(),
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup("<strong>Votre position</strong>");
    }
  }

  async function loadFavoriIds() {
    if (!enableFavoris) {
      favoriIds = new Set();
      return;
    }
    try {
      const favs = await MediCareAPI.getFavoris();
      favoriIds = new Set(favs.map((f) => f.id));
    } catch {
      favoriIds = new Set();
    }
  }

  function getFocusPharmacyId() {
    return new URLSearchParams(location.search).get("id");
  }

  async function fetchPharmacies(geo, filter) {
    const params = {};
    if (geo) {
      params.lat = geo.lat;
      params.lon = geo.lon;
    }
    if (filter === "ouvertes") params.ouvertes = true;

    let list = await MediCareAPI.getPharmacies(params);

    if (filter === "garde") list = list.filter((p) => p.est_de_garde);
    if (filter === "favoris" && enableFavoris) {
      await loadFavoriIds();
      list = list.filter((p) => favoriIds.has(p.id));
    } else if (enableFavoris) {
      await loadFavoriIds();
    }

    const focusId = getFocusPharmacyId();
    if (focusId && !list.some((p) => String(p.id) === String(focusId))) {
      try {
        const extraParams = geo ? { lat: geo.lat, lon: geo.lon } : {};
        const p = await MediCareAPI.getPharmacy(focusId, extraParams);
        if (pharmacyHasCoordinates(p)) list.push(p);
      } catch {
        /* pharmacie introuvable ou hors ligne */
      }
    }

    return list.filter((p) => pharmacyHasCoordinates(p));
  }

  function focusPharmacyOnMap(pharmacies) {
    const focusId = getFocusPharmacyId();
    if (!focusId || !map) return false;

    const p = pharmacies.find((ph) => String(ph.id) === String(focusId));
    if (!p) return false;

    const latlng = [Number(p.latitude), Number(p.longitude)];
    map.flyTo(latlng, 16, { duration: 0.8 });

    const marker = markerById.get(String(p.id));
    if (marker) {
      window.setTimeout(() => marker.openPopup(), 700);
    }
    return true;
  }

  function renderMarkers(pharmacies, geo) {
    markersLayer.clearLayers();
    markerById.clear();
    const bounds = [];

    if (userMarker) bounds.push(userMarker.getLatLng());

    for (const p of pharmacies) {
      const latlng = [Number(p.latitude), Number(p.longitude)];
      bounds.push(latlng);
      const marker = L.marker(latlng, { icon: createPharmacyIcon(p) });
      marker.bindPopup(popupHtml(p, geo));
      markersLayer.addLayer(marker);
      markerById.set(String(p.id), marker);
    }

    if (!focusPharmacyOnMap(pharmacies)) {
      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else if (geo) {
        map.setView([geo.lat, geo.lon], 13);
      }
    }
  }

  async function refreshMap() {
    setStatus("Chargement des pharmacies…");
    try {
      const pharmacies = await fetchPharmacies(lastGeo, currentFilter);
      renderMarkers(pharmacies, lastGeo);

      const n = pharmacies.length;
      if (n === 0) {
        setStatus(
          currentFilter === "favoris"
            ? "Aucun favori avec coordonnées GPS sur la carte."
            : "Aucune pharmacie à afficher pour ce filtre."
        );
      } else {
        let msg = `${n} pharmacie${n > 1 ? "s" : ""} affichée${n > 1 ? "s" : ""}${
          lastGeo ? " — tri par distance" : ""
        }`;
        if (pharmacies._offlineCache) {
          msg += " — données en cache (hors ligne)";
        }
        if (!navigator.onLine) {
          msg += " · fond de carte internet requis";
        }
        setStatus(msg);
      }
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function setActiveFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll(".map-filter-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.filter === filter);
    });
    refreshMap();
  }

  function initMap() {
    map = L.map("pharmacy-map", {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
  }

  async function locateUser(fly = true) {
    const geo = await ensureUserGeo();
    lastGeo = geo;
    if (!geo) {
      setStatus("Géolocalisation refusée — carte centrée sur Casablanca.", true);
      return null;
    }
    placeUserMarker(geo);
    if (fly) map.flyTo([geo.lat, geo.lon], 14, { duration: 0.8 });
    return geo;
  }

  function bindControls() {
    document.querySelectorAll(".map-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => setActiveFilter(btn.dataset.filter));
    });
    document.getElementById("btn-locate")?.addEventListener("click", async () => {
      await locateUser(true);
      await refreshMap();
    });
  }

  async function start() {
    if (typeof L === "undefined") {
      setStatus("Bibliothèque carte non chargée. Vérifiez votre connexion.", true);
      return;
    }

    initMap();
    bindControls();

    const geo = await locateUser(false);
    if (!geo) map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    await refreshMap();
    setTimeout(() => map?.invalidateSize(), 200);
  }

  function init(options = {}) {
    zone = options.zone === "utilisateur" ? "utilisateur" : "public";
    enableFavoris = !!options.enableFavoris;
    currentFilter = "all";
    window.addEventListener("medicare-connection-change", (e) => {
      if (!e.detail.online) refreshMap();
    });
    start();
  }

  return { init };
})();

window.PharmacyMap = PharmacyMap;
