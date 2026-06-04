(function () {
  const DEFAULT = [33.5731, -7.5898];
  let map = null;
  let marker = null;
  let imageDataUrl = null;
  let geocodeTimer = null;

  function setFormMsg(text, type = "") {
    const el = document.getElementById("form-msg");
    if (!el) return;
    el.textContent = text || "";
    el.className = "ap-form-msg";
    if (type === "error") el.classList.add("error");
    else if (type === "success") el.classList.add("success");
    else if (text) el.classList.add("muted");
  }

  function setLocationMsg(text, type = "error") {
    const el = document.getElementById("location-msg");
    if (!el) return;
    if (!text) {
      el.textContent = "";
      el.hidden = true;
      el.className = "pd-edit-location-msg hidden";
      return;
    }
    el.textContent = text;
    el.hidden = false;
    if (type === "ok") el.className = "pd-edit-location-msg pd-edit-location-msg--ok";
    else if (type === "warn") el.className = "pd-edit-location-msg pd-edit-location-msg--warn";
    else if (type === "pending") el.className = "pd-edit-location-msg muted";
    else el.className = "pd-edit-location-msg error";
  }

  function setHoursMsg(text) {
    const el = document.getElementById("hours-msg");
    if (!el) return;
    if (!text) {
      el.textContent = "";
      el.hidden = true;
      el.className = "pd-edit-hours-msg hidden";
      return;
    }
    el.textContent = text;
    el.hidden = false;
    el.className = "pd-edit-hours-msg";
  }

  function scrollToSection(sectionId) {
    const el = document.getElementById(`ap-section-${sectionId}`);
    if (!el) return;
    setActiveProgressNav(sectionId);
    el.classList.add("is-highlight");
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => el.classList.remove("is-highlight"), 1400);
    if (sectionId === "location") {
      setTimeout(() => map?.invalidateSize(), 300);
    }
  }

  function stepInfoDone() {
    return (document.getElementById("nom")?.value.trim() || "").length >= 2;
  }

  function stepLocationDone() {
    const lat = parseFloat(document.getElementById("latitude")?.value);
    const lon = parseFloat(document.getElementById("longitude")?.value);
    const ville = document.getElementById("ville")?.value.trim();
    const quartier = document.getElementById("quartier")?.value.trim();
    return Number.isFinite(lat) && Number.isFinite(lon) && !!ville && !!quartier;
  }

  function stepHoursDone(hoursRoot) {
    if (!hoursRoot || typeof WeeklyPharmacyHours === "undefined") return true;
    const week = WeeklyPharmacyHours.readFromForm(hoursRoot);
    return WeeklyPharmacyHours.validateWeekClient(week).ok;
  }

  function setActiveProgressNav(stepId) {
    document.querySelectorAll("[data-ap-goto]").forEach((btn) => {
      const on = btn.getAttribute("data-ap-goto") === stepId;
      btn.classList.toggle("is-active", on);
    });
    document.querySelectorAll(".ap-step-list__btn").forEach((btn) => {
      const on = btn.getAttribute("data-ap-goto") === stepId;
      btn.classList.toggle("is-active", on);
    });
  }

  function updateFormProgress(hoursRoot) {
    const steps = [
      { id: "info", done: stepInfoDone() },
      { id: "location", done: stepLocationDone() },
      { id: "hours", done: stepHoursDone(hoursRoot) },
    ];
    steps.forEach((s) => {
      const nav = document.getElementById(`ap-nav-${s.id}`);
      const mobile = document.querySelector(`.ap-steps-mobile__item[data-ap-goto="${s.id}"]`);
      nav?.classList.toggle("is-done", s.done);
      mobile?.classList.toggle("is-done", s.done);
    });
  }

  function setupProgressNav(hoursRoot) {
    document.querySelectorAll("[data-ap-goto]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const step = btn.getAttribute("data-ap-goto");
        if (step) scrollToSection(step);
      });
    });

    const refresh = () => updateFormProgress(hoursRoot);
    const form = document.getElementById("form-add-pharmacy");
    form?.addEventListener("input", refresh);
    form?.addEventListener("change", refresh);
    hoursRoot?.addEventListener("change", refresh);
    hoursRoot?.addEventListener("input", refresh);

    document.getElementById("nom")?.addEventListener("input", () => {
      const title = document.getElementById("nom")?.value.trim();
      if (imageDataUrl && typeof updatePharmaPhotoUploadUi === "function") {
        updatePharmaPhotoUploadUi("image", { hasImage: true, src: imageDataUrl, title });
      }
      refresh();
    });

    const panels = document.querySelectorAll("[data-ap-step]");
    if (panels.length && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (visible?.target?.dataset?.apStep) {
            setActiveProgressNav(visible.target.dataset.apStep);
          }
        },
        { rootMargin: "-12% 0px -55% 0px", threshold: [0.15, 0.35, 0.55] }
      );
      panels.forEach((p) => observer.observe(p));
    }

    refresh();
  }

  function refreshMapSize() {
    setTimeout(() => map?.invalidateSize(), 200);
  }

  function updateCoordsDisplay(lat, lon) {
    const el = document.getElementById("coords-display");
    if (!el) return;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      el.textContent = `GPS : ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      el.className = "pd-edit-coords";
    } else {
      el.textContent = "Repère non placé sur la carte";
      el.className = "pd-edit-coords pd-edit-coords--empty muted";
    }
  }

  function syncAdresseFields(text) {
    const hidden = document.getElementById("adresse");
    const visible = document.getElementById("adresse-visible");
    const wrap = document.getElementById("location-address-display");
    const span = document.getElementById("location-address-text");
    const value = String(text || "").trim();
    if (hidden) hidden.value = value;
    if (visible && document.activeElement !== visible) visible.value = value;
    if (wrap && span) {
      if (value) {
        span.textContent = value;
        wrap.hidden = false;
      } else {
        span.textContent = "";
        wrap.hidden = true;
      }
    }
  }

  function setCoords(lat, lon) {
    document.getElementById("latitude").value = lat;
    document.getElementById("longitude").value = lon;
    updateCoordsDisplay(lat, lon);
    document.getElementById("form-add-pharmacy")?.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function suggestAdresseFromForm() {
    const ville = document.getElementById("ville")?.value.trim();
    const quartier = document.getElementById("quartier")?.value.trim();
    if (quartier && ville) return `${quartier}, ${ville}, Maroc`;
    if (ville) return `${ville}, Maroc`;
    return "";
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
    ]);
  }

  async function reverseGeocodeClientFallback(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&accept-language=fr&addressdetails=1&zoom=18`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const data = await res.json();
      return String(data.display_name || "").trim() || null;
    } catch {
      return null;
    }
  }

  function applyGeoResult(geo) {
    const qEl = document.getElementById("quartier");
    const vEl = document.getElementById("ville");
    const visible = document.getElementById("adresse-visible");
    if (geo.quartier && qEl && !qEl.value.trim()) qEl.value = geo.quartier;
    if (geo.ville && vEl && !vEl.value.trim()) vEl.value = geo.ville;

    const fromApi = String(geo.adresse || "").trim();
    let adresse = fromApi;
    if (!adresse) adresse = suggestAdresseFromForm();

    if (adresse) {
      syncAdresseFields(adresse);
      if (visible && !visible.value.trim()) visible.value = adresse;
    } else {
      syncAdresseFields("");
    }

    return { fromApi: !!fromApi, filled: !!adresse };
  }

  async function resolveLocationFromCoords(lat, lon) {
    let geo = null;
    try {
      geo = await MediCareAPI.pharmaGeocodeReverse(lat, lon);
    } catch {
      geo = null;
    }

    if (!geo?.adresse) {
      const fromClient = await withTimeout(reverseGeocodeClientFallback(lat, lon), 6000).catch(
        () => null
      );
      if (fromClient) {
        geo = {
          adresse: fromClient,
          quartier: geo?.quartier || "",
          ville: geo?.ville || "",
          partial: false,
        };
      }
    }

    if (!geo) {
      const fallback = suggestAdresseFromForm();
      if (fallback) {
        return {
          geo: { adresse: "", quartier: "", ville: document.getElementById("ville")?.value.trim() },
          fullAddress: false,
          suggested: fallback,
        };
      }
      return { geo: null, fullAddress: false };
    }

    return { geo, fullAddress: !!String(geo.adresse || "").trim(), partial: !!geo.partial };
  }

  async function syncLocationFromMap() {
    const lat = parseFloat(document.getElementById("latitude").value);
    const lon = parseFloat(document.getElementById("longitude").value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      syncAdresseFields("");
      return false;
    }

    setLocationMsg("Calcul de l'adresse…", "pending");

    const result = await resolveLocationFromCoords(lat, lon);
    if (!result.geo) {
      setLocationMsg(
        "Position GPS enregistrée. Saisissez l'adresse complète dans le champ ci-dessous.",
        "warn"
      );
      return false;
    }

    const applied = applyGeoResult(result.geo);
    if (applied.fromApi && !result.partial) {
      setLocationMsg("Emplacement et adresse enregistrés.", "ok");
      return true;
    }
    if (applied.filled) {
      const visible = document.getElementById("adresse-visible");
      const hint = suggestAdresseFromForm();
      if (visible && !visible.value.trim() && hint) visible.placeholder = hint;
      setLocationMsg(
        "Position GPS OK. Vérifiez ou complétez l'adresse (numéro, rue) dans le champ ci-dessous.",
        "warn"
      );
      return false;
    }
    setLocationMsg(
      "Position GPS enregistrée. Indiquez la ville puis l'adresse complète.",
      "warn"
    );
    return false;
  }

  function scheduleGeocode() {
    if (geocodeTimer) clearTimeout(geocodeTimer);
    geocodeTimer = setTimeout(() => syncLocationFromMap(), 450);
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
      /* ignore */
    }
  }

  async function applyImageFile(file) {
    if (!file?.type?.startsWith("image/")) {
      alert("Choisissez une image (JPEG, PNG ou WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image trop grande (max 5 Mo).");
      return;
    }
    const resizeFn =
      typeof resizePharmacyImageFile === "function" ? resizePharmacyImageFile : resizeImageFile;
    imageDataUrl = await resizeFn(file);
    updatePharmaPhotoUploadUi("image", {
      hasImage: true,
      src: imageDataUrl,
      title: document.getElementById("nom")?.value?.trim(),
    });
    document.getElementById("form-add-pharmacy")?.dispatchEvent(new Event("change", { bubbles: true }));
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

  function mountPhotoUpload() {
    const mount = document.getElementById("add-photo-mount");
    if (!mount || typeof pharmaPhotoUploadHtml !== "function") return;
    mount.innerHTML = pharmaPhotoUploadHtml({ idPrefix: "image" });
    setupPharmaPhotoUpload({
      idPrefix: "image",
      onFile: applyImageFile,
      onRemove: () => {
        imageDataUrl = null;
        updatePharmaPhotoUploadUi("image", { hasImage: false });
        document.getElementById("form-add-pharmacy")?.dispatchEvent(new Event("change", { bubbles: true }));
      },
    });
  }

  function setupAdresseSync() {
    const visible = document.getElementById("adresse-visible");
    visible?.addEventListener("input", () => {
      syncAdresseFields(visible.value);
      setLocationMsg("");
    });
  }

  function mountWeeklyHours() {
    const mount = document.getElementById("add-weekly-hours-mount");
    if (!mount || typeof WeeklyPharmacyHours === "undefined") return null;
    mount.innerHTML = WeeklyPharmacyHours.editFormHtml({});
    const root = mount.querySelector("#pd-weekly-hours");
    if (root) WeeklyPharmacyHours.setupForm(root);
    return root;
  }

  function resetSubmitBtn(btn, label) {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove("is-loading");
    if (label) label.textContent = "Ajouter";
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!initPharmaPage()) return;
    initPharmacyDetailPhotoZoom();
    if (typeof L === "undefined") {
      setFormMsg("Carte non chargée — vérifiez votre connexion.", "error");
      return;
    }

    mountPhotoUpload();
    setupAdresseSync();

    const hoursRoot = mountWeeklyHours();
    setupProgressNav(hoursRoot);

    await loadLocationSuggestions();
    document.getElementById("ville")?.addEventListener("change", () => {
      loadLocationSuggestions(document.getElementById("ville").value.trim());
    });

    initMap();

    document.getElementById("btn-locate")?.addEventListener("click", async () => {
      setLocationMsg("");
      const btn = document.getElementById("btn-locate");
      if (btn) {
        btn.disabled = true;
        btn.classList.add("is-loading");
      }
      setLocationMsg("Recherche du signal GPS…", "pending");
      const geo = await getFreshUserPosition();
      if (!geo) {
        setLocationMsg("Autorisez la géolocalisation ou réessayez sur place.");
        if (btn) {
          btn.disabled = false;
          btn.classList.remove("is-loading");
        }
        scrollToSection("location");
        return;
      }
      placeMarker({ lat: geo.lat, lng: geo.lon }, true);
      scrollToSection("location");
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
      }
    });

    const initialGeo = await ensureUserGeo();
    if (initialGeo) {
      placeMarker({ lat: initialGeo.lat, lng: initialGeo.lon }, true);
    }

    refreshMapSize();
    window.addEventListener("resize", refreshMapSize);

    document.getElementById("form-add-pharmacy")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-submit");
      const label = btn?.querySelector(".ap-submit__label");
      setFormMsg("");
      setHoursMsg("");
      setLocationMsg("");

      if (btn) {
        btn.disabled = true;
        btn.classList.add("is-loading");
        if (label) label.textContent = "Ajout en cours…";
      }

      const nom = document.getElementById("nom").value.trim();
      if (!nom) {
        setFormMsg("Indiquez le nom de la pharmacie.", "error");
        resetSubmitBtn(btn, label);
        scrollToSection("info");
        return;
      }

      const lat = parseFloat(document.getElementById("latitude").value);
      const lon = parseFloat(document.getElementById("longitude").value);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        setFormMsg("Placez la pharmacie sur la carte (clic ou « Ma position »).", "error");
        setLocationMsg("Repère requis sur la carte.");
        resetSubmitBtn(btn, label);
        scrollToSection("location");
        return;
      }

      const ville = document.getElementById("ville").value.trim();
      const quartier = document.getElementById("quartier").value.trim();
      if (!ville || !quartier) {
        setFormMsg("Ville et quartier sont obligatoires.", "error");
        setLocationMsg("Indiquez la ville et le quartier.");
        resetSubmitBtn(btn, label);
        scrollToSection("location");
        return;
      }

      let adresse = document.getElementById("adresse").value.trim();
      if (!adresse) {
        const visible = document.getElementById("adresse-visible").value.trim();
        if (visible) syncAdresseFields(visible);
        adresse = document.getElementById("adresse").value.trim();
      }
      if (!adresse) {
        await syncLocationFromMap();
        adresse = document.getElementById("adresse").value.trim();
      }
      if (!adresse) {
        const hint = suggestAdresseFromForm();
        if (hint) {
          syncAdresseFields(hint);
          document.getElementById("adresse-visible").value = hint;
          adresse = hint;
        }
      }
      if (!adresse) {
        setFormMsg("Adresse requise — saisissez l'adresse complète (numéro, rue).", "error");
        setLocationMsg("Complétez le champ adresse ci-dessous.");
        resetSubmitBtn(btn, label);
        scrollToSection("location");
        return;
      }

      let horairesSemaine;
      if (typeof WeeklyPharmacyHours !== "undefined" && hoursRoot) {
        horairesSemaine = WeeklyPharmacyHours.readFromForm(hoursRoot);
        const weekCheck = WeeklyPharmacyHours.validateWeekClient(horairesSemaine);
        if (!weekCheck.ok) {
          setHoursMsg(weekCheck.error);
          setFormMsg("Corrigez les horaires avant d'enregistrer.", "error");
          resetSubmitBtn(btn, label);
          scrollToSection("hours");
          return;
        }
      }

      try {
        const result = await MediCareAPI.createPharmaPharmacy({
          nom,
          adresse,
          quartier,
          ville,
          telephone: document.getElementById("telephone").value.trim() || null,
          horaires_semaine: horairesSemaine,
          latitude: lat,
          longitude: lon,
          imageDataUrl: imageDataUrl || null,
        });
        setFormMsg(result.message || "Pharmacie enregistrée — redirection…", "success");
        setTimeout(() => {
          window.location.href = `pharmacieDetail.html?id=${result.id}`;
        }, 700);
      } catch (err) {
        setFormMsg(err.message || "Enregistrement impossible.", "error");
        resetSubmitBtn(btn, label);
      }
    });
  });
})();
