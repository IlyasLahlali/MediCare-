/* Horaires par jour — partagé espace pharmacien & affichage public */
const WeeklyPharmacyHours = (function () {
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
  const JS_DAY_TO_KEY = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

  function normalizeTime(value) {
    if (value == null || value === "") return "";
    const m = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return "";
    return `${String(m[1]).padStart(2, "0")}:${m[2]}`;
  }

  function formatTimeShort(t) {
    const n = normalizeTime(t);
    if (!n) return "";
    const [h, m] = n.split(":");
    return m === "00" ? `${parseInt(h, 10)}h` : `${parseInt(h, 10)}h${m}`;
  }

  function defaultDay(open = "09:00", close = "17:00", closed = false) {
    return {
      closed: !!closed,
      open: closed ? "" : normalizeTime(open),
      close: closed ? "" : normalizeTime(close),
    };
  }

  function defaultWeek(open = "09:00", close = "17:00") {
    const d = defaultDay(open, close, false);
    return Object.fromEntries(DAY_KEYS.map((k) => [k, { ...d, open: d.open, close: d.close }]));
  }

  function firstOpenDayHours(week) {
    for (const key of DAY_KEYS) {
      const d = week[key];
      if (d && !d.closed && d.open && d.close) {
        return { open: d.open, close: d.close };
      }
    }
    return { open: "09:00", close: "17:00" };
  }

  function isDayClosed(d) {
    if (!d) return true;
    const c = d.closed;
    return c === true || c === 1 || c === "1" || c === "true";
  }

  function parseRawWeek(raw) {
    if (raw == null || raw === "") return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (typeof raw === "object") return raw;
    return null;
  }

  function hasStoredWeekField(p) {
    const h = p?.horaires_semaine;
    return h != null && h !== "";
  }

  function weekFromPharmacy(p) {
    if (!p) return defaultWeek();
    const raw = parseRawWeek(p.horaires_semaine);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const out = {};
      for (const key of DAY_KEYS) {
        const d = raw[key] || {};
        if (isDayClosed(d)) out[key] = defaultDay("", "", true);
        else out[key] = defaultDay(d.open || "09:00", d.close || "17:00", false);
      }
      return out;
    }
    if (!hasStoredWeekField(p) && (p.heure_ouverture || p.heure_fermeture)) {
      return defaultWeek(
        normalizeTime(p.heure_ouverture) || "09:00",
        normalizeTime(p.heure_fermeture) || "17:00"
      );
    }
    return null;
  }

  function validateWeekClient(week) {
    if (!week) return { ok: false, error: "Horaires invalides." };
    let hasOpen = false;
    for (const key of DAY_KEYS) {
      const d = week[key];
      if (!isDayClosed(d)) {
        if (!d?.open || !d?.close) {
          return { ok: false, error: `Horaires incomplets pour ${DAY_LABELS[key]}.` };
        }
        hasOpen = true;
      }
    }
    if (!hasOpen) return { ok: false, error: "Indiquez au moins un jour d'ouverture." };
    return { ok: true };
  }

  function parseScheduleMinutes(value) {
    const n = normalizeTime(value);
    if (!n) return null;
    const [h, m] = n.split(":").map(Number);
    return h * 60 + m;
  }

  function dayKeyForDate(date = new Date()) {
    return JS_DAY_TO_KEY[date.getDay()];
  }

  function isOpenBySchedule(p, date = new Date()) {
    const week = weekFromPharmacy(p);
    if (!week) return null;
    const day = week[dayKeyForDate(date)];
    if (!day || isDayClosed(day)) return false;
    const openM = parseScheduleMinutes(day.open);
    const closeM = parseScheduleMinutes(day.close);
    if (openM == null || closeM == null) return null;
    const nowM = date.getHours() * 60 + date.getMinutes();
    if (openM < closeM) return nowM >= openM && nowM < closeM;
    return nowM >= openM || nowM < closeM;
  }

  function compactDisplay(p) {
    const week = weekFromPharmacy(p);
    if (!week) return "";
    const parts = [];
    for (const key of DAY_KEYS) {
      const d = week[key];
      const label = DAY_LABELS[key].slice(0, 3);
      if (isDayClosed(d)) parts.push(`${label} fermé`);
      else parts.push(`${label} ${formatTimeShort(d.open)}–${formatTimeShort(d.close)}`);
    }
    return parts.join(" · ");
  }

  /** Une ligne pour les cartes liste : priorité au jour courant. */
  function cardDisplay(p, date = new Date()) {
    const week = weekFromPharmacy(p);
    if (!week) {
      const start = formatTimeShort(p?.heure_ouverture);
      const end = formatTimeShort(p?.heure_fermeture);
      if (start && end) return `${start} – ${end}`;
      return "";
    }
    const key = dayKeyForDate(date);
    const dayName = DAY_LABELS[key];
    const day = week[key];
    if (isDayClosed(day)) {
      return `Aujourd'hui (${dayName}) : fermé`;
    }
    return `Aujourd'hui : ${formatTimeShort(day.open)} – ${formatTimeShort(day.close)}`;
  }

  function todayDisplay(p, date = new Date()) {
    const week = weekFromPharmacy(p);
    if (!week) return "";
    const key = dayKeyForDate(date);
    const day = week[key];
    const dayName = DAY_LABELS[key];
    if (isDayClosed(day)) return `Aujourd'hui (${dayName}) : fermé`;
    return `Aujourd'hui (${dayName}) : ${formatTimeShort(day.open)} – ${formatTimeShort(day.close)}`;
  }

  function listDisplayHtml(p, options = {}) {
    const highlightToday = options.highlightToday !== false;
    const todayKey = dayKeyForDate(options.date || new Date());
    const week = weekFromPharmacy(p) || defaultWeek();
    return DAY_KEYS.map((key) => {
      const d = week[key] || defaultDay("", "", true);
      const line = isDayClosed(d)
        ? "Fermé"
        : `${formatTimeShort(d.open)} – ${formatTimeShort(d.close)}`;
      const todayClass = highlightToday && key === todayKey ? "is-today" : "";
      return `<li${todayClass ? ` class="${todayClass}"` : ""}><span class="pd-hours-day">${DAY_LABELS[key]}</span><span class="pd-hours-time">${line}</span></li>`;
    }).join("");
  }

  function editFormHtml(p) {
    const week = weekFromPharmacy(p) || defaultWeek();
    const tpl = firstOpenDayHours(week);
    const closedQuick = DAY_KEYS.map(
      (key) =>
        `<label class="pd-hours-closed-quick__day"><input type="checkbox" class="pd-hours-closed-quick-cb" data-day="${key}" ${isDayClosed(week[key]) ? "checked" : ""} /><span>${DAY_LABELS[key]}</span></label>`
    ).join("");
    const rows = DAY_KEYS.map((key) => {
      const d = week[key] || defaultDay("", "", true);
      const closed = isDayClosed(d);
      return `
        <div class="pd-hours-row" data-day="${key}">
          <span class="pd-hours-row__day">${DAY_LABELS[key]}</span>
          <label class="pd-hours-row__closed">
            <input type="checkbox" class="pd-hours-closed" data-day="${key}" ${closed ? "checked" : ""} />
            <span>Fermé</span>
          </label>
          <label class="pd-hours-row__time ${closed ? "is-disabled" : ""}">
            <span class="sr-only">Ouverture ${DAY_LABELS[key]}</span>
            <input type="time" class="pd-hours-open" data-day="${key}" value="${d.open || ""}" ${closed ? "disabled" : ""} />
          </label>
          <span class="pd-hours-row__sep" aria-hidden="true">→</span>
          <label class="pd-hours-row__time ${closed ? "is-disabled" : ""}">
            <span class="sr-only">Fermeture ${DAY_LABELS[key]}</span>
            <input type="time" class="pd-hours-close" data-day="${key}" value="${d.close || ""}" ${closed ? "disabled" : ""} />
          </label>
        </div>`;
    }).join("");

    return `
      <div class="pd-weekly-hours" id="pd-weekly-hours">
        <label class="pd-hours-same">
          <input type="checkbox" id="pd-hours-same-all" />
          <span>Même horaire pour tous les jours ouverts</span>
        </label>
        <div class="pd-hours-same-fields hidden" id="pd-hours-same-fields">
          <label class="pd-hours-same-field">Ouverture <input type="time" id="pd-hours-template-open" value="${tpl.open}" /></label>
          <label class="pd-hours-same-field">Fermeture <input type="time" id="pd-hours-template-close" value="${tpl.close}" /></label>
        </div>
        <div class="pd-hours-closed-quick hidden" id="pd-hours-closed-quick">
          <span class="pd-hours-closed-quick__label">Jours fermés</span>
          <div class="pd-hours-closed-quick__days">${closedQuick}</div>
        </div>
        <p class="field-hint muted pd-hours-detail-hint" id="pd-hours-detail-hint">
          Par défaut, renseignez chaque jour ci-dessous. Cochez l'option ci-dessus pour appliquer le même horaire à tous les jours ouverts.
        </p>
        <div class="pd-hours-table-wrap" id="pd-hours-detail-wrap">
          <div class="pd-hours-table-head" aria-hidden="true">
            <span>Jour</span><span>Fermé</span><span>Ouverture</span><span></span><span>Fermeture</span>
          </div>
          <div class="pd-hours-grid">${rows}</div>
        </div>
      </div>`;
  }

  function isDayClosedInForm(root, key) {
    const row = root.querySelector(`.pd-hours-row[data-day="${key}"]`);
    const quick = root.querySelector(`.pd-hours-closed-quick-cb[data-day="${key}"]`);
    return !!(row?.querySelector(".pd-hours-closed")?.checked || quick?.checked);
  }

  function readFromForm(root) {
    const same = !!root.querySelector("#pd-hours-same-all")?.checked;
    const tplOpen = normalizeTime(root.querySelector("#pd-hours-template-open")?.value);
    const tplClose = normalizeTime(root.querySelector("#pd-hours-template-close")?.value);
    const week = {};

    for (const key of DAY_KEYS) {
      const row = root.querySelector(`.pd-hours-row[data-day="${key}"]`);
      const closed = isDayClosedInForm(root, key);

      if (closed) {
        week[key] = { closed: true, open: null, close: null };
        continue;
      }

      if (same && tplOpen && tplClose) {
        week[key] = { closed: false, open: tplOpen, close: tplClose };
        continue;
      }

      const openEl = row?.querySelector(".pd-hours-open");
      const closeEl = row?.querySelector(".pd-hours-close");
      const open = normalizeTime(openEl?.value || openEl?.getAttribute("value"));
      const close = normalizeTime(closeEl?.value || closeEl?.getAttribute("value"));
      week[key] = {
        closed: false,
        open: open || null,
        close: close || null,
      };
    }
    return week;
  }

  function setDayClosedInForm(root, key, closed) {
    const row = root.querySelector(`.pd-hours-row[data-day="${key}"]`);
    const quick = root.querySelector(`.pd-hours-closed-quick-cb[data-day="${key}"]`);
    const rowCb = row?.querySelector(".pd-hours-closed");
    if (rowCb) rowCb.checked = closed;
    if (quick) quick.checked = closed;
    row?.querySelectorAll(".pd-hours-open, .pd-hours-close").forEach((input) => {
      input.disabled = closed;
    });
    row?.querySelectorAll(".pd-hours-row__time").forEach((lab) => {
      lab.classList.toggle("is-disabled", closed);
    });
  }

  function setupForm(root) {
    const sameCb = root.querySelector("#pd-hours-same-all");
    const sameFields = root.querySelector("#pd-hours-same-fields");
    const detailWrap = root.querySelector("#pd-hours-detail-wrap");
    const detailHint = root.querySelector("#pd-hours-detail-hint");
    const tplOpen = root.querySelector("#pd-hours-template-open");
    const tplClose = root.querySelector("#pd-hours-template-close");

    const closedQuick = root.querySelector("#pd-hours-closed-quick");

    const syncSameModeUi = () => {
      const same = !!sameCb?.checked;
      if (sameFields) sameFields.classList.toggle("hidden", !same);
      if (closedQuick) closedQuick.classList.toggle("hidden", !same);
      if (detailWrap) detailWrap.classList.toggle("hidden", same);
      if (detailHint) detailHint.classList.toggle("hidden", same);
    };

    const applyTemplate = () => {
      if (!sameCb?.checked) return;
      const o = tplOpen?.value;
      const c = tplClose?.value;
      root.querySelectorAll(".pd-hours-row").forEach((row) => {
        const closed = row.querySelector(".pd-hours-closed")?.checked;
        if (closed) return;
        const openIn = row.querySelector(".pd-hours-open");
        const closeIn = row.querySelector(".pd-hours-close");
        if (openIn) openIn.value = o;
        if (closeIn) closeIn.value = c;
      });
    };

    sameCb?.addEventListener("change", () => {
      syncSameModeUi();
      if (sameCb.checked) applyTemplate();
    });
    syncSameModeUi();
    tplOpen?.addEventListener("change", applyTemplate);
    tplClose?.addEventListener("change", applyTemplate);

    if (sameCb?.checked) applyTemplate();

    const onClosedChange = (key, closed) => {
      setDayClosedInForm(root, key, closed);
      if (!closed && sameCb?.checked) applyTemplate();
    };

    root.querySelectorAll(".pd-hours-closed").forEach((cb) => {
      cb.addEventListener("change", () => onClosedChange(cb.dataset.day, cb.checked));
    });

    root.querySelectorAll(".pd-hours-closed-quick-cb").forEach((cb) => {
      cb.addEventListener("change", () => onClosedChange(cb.dataset.day, cb.checked));
    });
  }

  return {
    DAY_KEYS,
    DAY_LABELS,
    weekFromPharmacy,
    defaultWeek,
    compactDisplay,
    cardDisplay,
    todayDisplay,
    listDisplayHtml,
    editFormHtml,
    readFromForm,
    validateWeekClient,
    setupForm,
    isOpenBySchedule,
    normalizeTime,
  };
})();
