const fs = require("fs");
const path = require("path");

function parseBool(v) {
  return v === true || v === "true" || v === "on" || v === "1";
}

function parseBodyFields(body) {
  const lat = parseFloat(body.latitude);
  const lon = parseFloat(body.longitude);
  return {
    nom: String(body.nom || "").trim(),
    adresse: String(body.adresse || "").trim(),
    quartier: String(body.quartier || "").trim() || null,
    ville: String(body.ville || "").trim() || null,
    telephone: String(body.telephone || "").trim() || null,
    heure_ouverture: body.heure_ouverture || null,
    heure_fermeture: body.heure_fermeture || null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
    est_de_garde: parseBool(body.est_de_garde),
  };
}

const NOMINATIM_HEADERS = {
  "User-Agent": "MediCarePlus/1.0 (pharmacien; geocode)",
  Accept: "application/json",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNominatimJson(url, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return await res.json();
      if (res.status === 429 || res.status >= 500) {
        await sleep(1200 * (i + 1));
        continue;
      }
      return null;
    } catch {
      clearTimeout(timeout);
      if (i < attempts - 1) await sleep(900 * (i + 1));
    }
  }
  return null;
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr&addressdetails=1&zoom=18`;
  const data = await fetchNominatimJson(url);
  if (!data) return null;
  try {
    const a = data.address || {};
    const country = String(a.country || "").trim();
    const isCountry = (s) => {
      const n = String(s || "").trim().toLowerCase();
      return (
        !n ||
        n === country.toLowerCase() ||
        /^(maroc|morocco|moroc|france|espagne|spain|algérie|algeria|tunisie|tunisia)$/.test(n)
      );
    };

    const ville =
      [a.city, a.town, a.municipality, a.state_district, a.county, a.state]
        .find((v) => v && !isCountry(v)) || "";

    const rawQuartier =
      [a.city_district, a.suburb, a.neighbourhood, a.quarter, a.village, a.hamlet].find(
        (q) => q && q !== ville && !isCountry(q)
      ) || "";
    const quartier = rawQuartier
      ? String(rawQuartier)
          .replace(/^arrondissement\s+(de\s+)?/i, "")
          .trim() || rawQuartier
      : "";

    const street = [a.house_number, a.road || a.pedestrian || a.footway]
      .filter(Boolean)
      .join(" ")
      .trim();
    const locality = [a.suburb, a.neighbourhood, a.quarter, a.city_district]
      .find((v) => v && !isCountry(v));
    const adresseParts = [street, locality, ville && ville !== locality ? ville : "", country]
      .map((s) => String(s || "").trim())
      .filter(Boolean);
    let adresse = String(data.display_name || "").trim() || adresseParts.join(", ");
    if (!adresse) {
      const locParts = [street, quartier, ville].map((s) => String(s || "").trim()).filter(Boolean);
      if (locParts.length) adresse = `${locParts.join(", ")}, Maroc`;
    }

    return {
      adresse: adresse.trim(),
      quartier: quartier.trim(),
      ville: ville.trim(),
    };
  } catch {
    return null;
  }
}

function buildForwardGeocodeQuery({ adresse, quartier, ville, q }) {
  const direct = String(q || "").trim();
  if (direct) return direct;
  const parts = [adresse, quartier, ville]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  if (!parts.length) return "";
  return `${parts.join(", ")}, Maroc`;
}

async function forwardGeocode(params) {
  const query = buildForwardGeocodeQuery(params || {});
  if (!query) return null;

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const data = await fetchNominatimJson(url);
  if (!data) return null;
  try {
    const hit = data?.[0];
    if (!hit) return null;
    const lat = parseFloat(hit.lat);
    const lon = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      latitude: lat,
      longitude: lon,
      display_name: hit.display_name || query,
    };
  } catch {
    return null;
  }
}

module.exports = {
  parseBodyFields,
  reverseGeocode,
  forwardGeocode,
  buildForwardGeocodeQuery,
  fetchNominatimJson,
};
