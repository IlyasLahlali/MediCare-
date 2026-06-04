const DAY_KEYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const DAY_LABELS = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
  dimanche: "Dimanche",
};

/** MySQL DAYOFWEEK : 1 = dimanche … 7 = samedi */
const MYSQL_DOW_TO_KEY = {
  1: "dimanche",
  2: "lundi",
  3: "mardi",
  4: "mercredi",
  5: "jeudi",
  6: "vendredi",
  7: "samedi",
};

const JS_DAY_TO_KEY = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function parseScheduleMinutes(value) {
  if (value == null || value === "") return null;
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function normalizeTime(value) {
  if (value == null || value === "") return null;
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${String(m[1]).padStart(2, "0")}:${m[2]}`;
}

function defaultDay(open = "09:00", close = "17:00", closed = false) {
  return { closed: !!closed, open: closed ? null : normalizeTime(open), close: closed ? null : normalizeTime(close) };
}

function defaultWeek(open = "09:00", close = "17:00") {
  const day = defaultDay(open, close, false);
  return Object.fromEntries(DAY_KEYS.map((k) => [k, { ...day }]));
}

function weekFromLegacy(open, close) {
  if (!open && !close) return null;
  return defaultWeek(open || "09:00", close || "17:00");
}

function normalizeWeekInput(raw) {
  if (raw == null || raw === "") return null;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(raw)) {
    raw = raw.toString("utf8");
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  return null;
}

function parseWeekSchedule(raw) {
  const obj = normalizeWeekInput(raw);
  if (!obj) return null;
  const out = {};
  for (const key of DAY_KEYS) {
    const d = obj[key];
    if (!d || d.closed === true || d.closed === "true" || d.closed === 1 || d.closed === "1") {
      out[key] = defaultDay(null, null, true);
    } else {
      const open = normalizeTime(d.open);
      const close = normalizeTime(d.close);
      if (!open || !close) {
        out[key] = defaultDay(null, null, true);
      } else {
        out[key] = { closed: false, open, close };
      }
    }
  }
  return out;
}

function serializeWeek(week) {
  if (!week) return null;
  return JSON.stringify(week);
}

/** Objet semaine pour les réponses API (évite string JSON / Buffer côté client). */
function horairesSemaineForApi(raw) {
  return parseWeekSchedule(raw);
}

function attachHorairesSemaineToPharmacy(row) {
  if (!row) return row;
  const week = horairesSemaineForApi(row.horaires_semaine);
  if (week) row.horaires_semaine = week;
  return row;
}

function dayKeyForDate(date = new Date()) {
  return JS_DAY_TO_KEY[date.getDay()];
}

function isOpenForDay(day, date = new Date()) {
  if (!day || day.closed) return false;
  const openM = parseScheduleMinutes(day.open);
  const closeM = parseScheduleMinutes(day.close);
  if (openM == null || closeM == null) return false;
  const nowM = date.getHours() * 60 + date.getMinutes();
  if (openM < closeM) return nowM >= openM && nowM < closeM;
  return nowM >= openM || nowM < closeM;
}

function isOpenByWeekRow(row, date = new Date()) {
  const week = parseWeekSchedule(row?.horaires_semaine);
  if (!week) return null;
  return isOpenForDay(week[dayKeyForDate(date)], date);
}

function legacyTimesFromWeek(week) {
  if (!week) return { heure_ouverture: null, heure_fermeture: null };
  for (const key of DAY_KEYS) {
    const d = week[key];
    if (d && !d.closed && d.open && d.close) {
      return { heure_ouverture: d.open, heure_fermeture: d.close };
    }
  }
  return { heure_ouverture: null, heure_fermeture: null };
}

function validateWeek(week) {
  if (!week) return { ok: false, error: "Horaires invalides." };
  let hasOpen = false;
  for (const key of DAY_KEYS) {
    const d = week[key];
    if (!d?.closed) {
      if (!d?.open || !d?.close) {
        return { ok: false, error: `Horaires incomplets pour ${DAY_LABELS[key]}.` };
      }
      if (parseScheduleMinutes(d.open) == null || parseScheduleMinutes(d.close) == null) {
        return { ok: false, error: `Heures invalides pour ${DAY_LABELS[key]}.` };
      }
      hasOpen = true;
    }
  }
  if (!hasOpen) return { ok: false, error: "Indiquez au moins un jour d'ouverture." };
  return { ok: true };
}

module.exports = {
  DAY_KEYS,
  DAY_LABELS,
  defaultWeek,
  weekFromLegacy,
  parseWeekSchedule,
  serializeWeek,
  horairesSemaineForApi,
  attachHorairesSemaineToPharmacy,
  dayKeyForDate,
  isOpenForDay,
  isOpenByWeekRow,
  legacyTimesFromWeek,
  validateWeek,
  normalizeTime,
};
