(function () {
  const DEFAULT = [33.5731, -7.5898];
  let map = null;
  let marker = null;
  let imageDataUrl = null;
  let geocodeTimer = null;

  function setCoords(lat, lon) {
    document.getElementById("latitude").value = lat;
    document.getElementById("longitude").value = lon;
    document.getElementById("coords-display").textContent =
      `Position : ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }

  function showResolvedAddress(text) {
    const wrap = document.getElementById("location-address-display");
    const span = document.getElementById("location-address-text");
    const hidden = document.getElementById("adresse");
    if (!wrap || !span || !hidden) return;
    if (text) {
      hidden.value = text;
      span.textContent = text;
      wrap.hidden = false;
    } else {
      hidden.value = "";
      span.textContent = "";
      wrap.hidden = true;
    }
  }

  async function syncLocationFromMap() {
    const lat = parseFloat(document.getElementById("latitude").value);
    const lon = parseFloat(document.getElementById("longitude").value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      showResolvedAddress("");
      return false;
    }

    const msg = document.getElementById("form-msg");
    msg.textContent = "Localisation en cours…";
    msg.className = "muted";

    try {
      const geo = await MediCareAPI.pharmaGeocodeReverse(lat, lon);
      if (geo.adresse) showResolvedAddress(geo.adresse);
      const qEl = document.getElementById("quartier");
      const vEl = document.getElementById("ville");
      if (geo.quartier && qEl && !qEl.value.trim()) qEl.value = geo.quartier;
      if (geo.ville && vEl && !vEl.value.trim()) vEl.value = geo.ville;
      msg.textContent = geo.adresse
        ? "Emplacement et adresse enregistrés."
        : "Position enregistrée — complétez ville et quartier si besoin.";
      msg.className = "muted";
      return !!geo.adresse;
    } catch (err) {
      msg.textContent = err.message;
      msg.className = "error";
      return false;
    }
  }

  function scheduleGeocode() {
    if (geocodeTimer) clearTimeout(geocodeTimer);
    geocodeTimer = setTimeout(() => syncLocationFromMap(), 400);
  }

  function placeMarker(latlng, fly = false) {
    if (marker) {
      marker.setLatLng(latlng);
    } else {
      marker = L.marker(latlng, { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        setCoords(p.lat, p.lng);
        scheduleGeocode();
      });
    }
    setCoords(latlng.lat, latlng.lng);
    if (fly) map.setView(latlng, 16);
    scheduleGeocode();
  }

  function initMap() {
    map = L.map("location-map").setView(DEFAULT, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e) => placeMarker(e.latlng));
  }

  async function resizeImageFile(file) {
    const maxW = 1200;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = (h * maxW) / w;
          w = maxW;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function fillDatalist(id, values) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = (values || [])
      .map((v) => `<option value="${String(v).replace(/"/g, "&quot;")}"></option>`)
      .join("");
  }

  async function loadLocationSuggestions(ville) {
    try {
      const data = await MediCareAPI.getPharmacyFilters(ville || undefined);
      if (!ville) fillDatalist("ville-suggestions", data.villes || []);
      fillDatalist("quartier-suggestions", data.quartiers || []);
    } catch {
      /* migration ou API indisponible */
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!initPharmaPage()) return;
    if (typeof L === "undefined") {
      document.getElementById("form-msg").textContent = "Carte non chargée.";
      return;
    }

    await loadLocationSuggestions();
    document.getElementById("ville")?.addEventListener("change", () => {
      loadLocationSuggestions(document.getElementById("ville").value.trim());
    });

    initMap();

    document.getElementById("btn-locate").addEventListener("click", async () => {
      const geo = await ensureUserGeo();
      if (!geo) {
        alert("Autorisez la géolocalisation dans le navigateur.");
        return;
      }
      placeMarker({ lat: geo.lat, lng: geo.lon }, true);
    });

    document.getElementById("image-input").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      const preview = document.getElementById("image-preview");
      const placeholder = document.getElementById("image-placeholder");
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert("Image trop grande (max 5 Mo).");
        e.target.value = "";
        return;
      }
      imageDataUrl = await resizeImageFile(file);
      preview.src = imageDataUrl;
      preview.classList.remove("hidden");
      placeholder.hidden = true;
    });

    const geo = await ensureUserGeo();
    if (geo) {
      placeMarker({ lat: geo.lat, lng: geo.lon }, true);
    }

    setTimeout(() => map?.invalidateSize(), 300);

    document.getElementById("form-add-pharmacy").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("form-msg");
      const btn = document.getElementById("btn-submit");
      msg.textContent = "";
      btn.disabled = true;

      const lat = parseFloat(document.getElementById("latitude").value);
      const lon = parseFloat(document.getElementById("longitude").value);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        msg.textContent =
          "Localisez la pharmacie sur la carte (bouton ou clic sur la carte).";
        msg.className = "error";
        btn.disabled = false;
        return;
      }

      const ville = document.getElementById("ville").value.trim();
      const quartier = document.getElementById("quartier").value.trim();
      if (!ville || !quartier) {
        msg.textContent = "Ville et quartier sont obligatoires pour la recherche des patients.";
        msg.className = "error";
        btn.disabled = false;
        return;
      }

      let adresse = document.getElementById("adresse").value.trim();
      if (!adresse) {
        const ok = await syncLocationFromMap();
        adresse = document.getElementById("adresse").value.trim();
        if (!ok || !adresse) {
          msg.textContent =
            "Impossible d’obtenir l’adresse — repositionnez le repère sur la carte.";
          msg.className = "error";
          btn.disabled = false;
          return;
        }
      }

      try {
        const result = await MediCareAPI.createPharmaPharmacy({
          nom: document.getElementById("nom").value.trim(),
          adresse,
          quartier,
          ville,
          telephone: document.getElementById("telephone").value.trim() || null,
          heure_ouverture: document.getElementById("heure_ouverture").value || null,
          heure_fermeture: document.getElementById("heure_fermeture").value || null,
          latitude: lat,
          longitude: lon,
          est_ouverte: document.getElementById("est_ouverte").checked,
          est_de_garde: document.getElementById("est_de_garde").checked,
          imageDataUrl: imageDataUrl || null,
        });
        msg.textContent = result.message || "Pharmacie enregistrée.";
        msg.className = "muted";
        setTimeout(() => {
          window.location.href = `pharmacieDetail.html?id=${result.id}`;
        }, 800);
      } catch (err) {
        msg.textContent = err.message;
        msg.className = "error";
        btn.disabled = false;
      }
    });
  });
})();
