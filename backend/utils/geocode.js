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
    est_ouverte: parseBool(body.est_ouverte),
    est_de_garde: parseBool(body.est_de_garde),
  };
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr&addressdetails=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MediCarePlus/1.0 (pharmacien)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
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
      [a.city, a.town, a.municipality, a.state_district].find((v) => v && !isCountry(v)) || "";

    const rawQuartier =
      [a.city_district, a.suburb, a.neighbourhood, a.quarter, a.village, a.hamlet].find(
        (q) => q && q !== ville && !isCountry(q)
      ) || "";
    const quartier = rawQuartier
      ? String(rawQuartier)
          .replace(/^arrondissement\s+(de\s+)?/i, "")
          .trim() || rawQuartier
      : "";

    return {
      adresse: data.display_name || "",
      quartier,
      ville,
    };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

module.exports = { parseBodyFields, reverseGeocode };
