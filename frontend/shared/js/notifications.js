/**
 * Centre de notifications MediCare+ (panneau + toasts + polling).
 */
const NotificationCenter = (() => {
  const BELL_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>`;

  const NOTIF_ICON_SVG = {
    FAVORI: `<svg class="notif-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    AVIS: `<svg class="notif-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8M8 14h5"/></svg>`,
  };

  const TYPE_META = {
    SYSTEM: { icon: "⚙️", label: "Système", class: "type-system" },
    GARDE: { icon: "🌙", label: "Garde", class: "type-garde" },
    STOCK: { icon: "💊", label: "Stock", class: "type-stock" },
    FAVORI: { iconHtml: NOTIF_ICON_SVG.FAVORI, label: "Favoris", class: "type-favori" },
    ALERT: { icon: "⚠️", label: "Alerte", class: "type-alert" },
    INFO: { icon: "ℹ️", label: "Info", class: "type-info" },
    AVIS: { iconHtml: NOTIF_ICON_SVG.AVIS, label: "Avis", class: "type-avis" },
    STATS: { icon: "📊", label: "Stats", class: "type-stats" },
  };

  let state = {
    open: false,
    filter: "all",
    items: [],
    unread: 0,
    pollTimer: null,
    lastUnread: null,
    mounted: false,
  };

  let els = {};

  function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text ?? "";
    return d.innerHTML;
  }

  function formatNotificationMessage(message) {
    return String(message || "").replace(/^\[[^\]]+\]\s*/, "");
  }

  function formatRelative(dateStr) {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "À l'instant";
    const min = Math.floor(sec / 60);
    if (min < 60) return `Il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `Il y a ${h} h`;
    const d = Math.floor(h / 24);
    if (d === 1) return "Hier";
    if (d < 7) return `Il y a ${d} j`;
    return date.toLocaleDateString("fr-MA", { day: "numeric", month: "short" });
  }

  function groupLabel(dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const diff = (today - day) / 86400000;
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return "Hier";
    if (diff < 7) return "Cette semaine";
    return "Plus ancien";
  }

  function resolveLink(lien) {
    if (!lien) return null;
    if (lien.startsWith("http")) return lien;
    const path = lien.startsWith("/") ? lien.slice(1) : String(lien).replace(/^\//, "");
    return pageUrl(path);
  }

  function updateBadge(unread) {
    state.unread = unread;
    if (!els.badge) return;
    if (unread <= 0) {
      els.badge.classList.add("is-hidden");
      els.bell?.classList.remove("has-unread");
      return;
    }
    els.badge.classList.remove("is-hidden");
    els.bell?.classList.add("has-unread");
    if (unread > 9) {
      els.badge.textContent = "9+";
      els.badge.classList.remove("is-dot");
    } else {
      els.badge.textContent = String(unread);
      els.badge.classList.remove("is-dot");
    }
  }

  async function refreshSummary() {
    try {
      const summary = await MediCareAPI.getNotificationSummary();
      const unread = Number(summary.unread) || 0;
      const prev = state.lastUnread;
      state.lastUnread = unread;
      updateBadge(unread);
      if (els.subtitle && !state.open) {
        els.subtitle.textContent =
          unread > 0
            ? `${unread} non lue${unread > 1 ? "s" : ""}`
            : "Tout est à jour";
      }
      if (prev !== null && unread > prev) {
        const delta = unread - prev;
        if (!state.open) {
          showToast({
            type: "INFO",
            titre: delta === 1 ? "Nouvelle notification" : `${delta} nouvelles notifications`,
            message: "Ouvrez le centre pour les consulter.",
          });
        } else {
          loadList();
        }
      }
      return unread;
    } catch (err) {
      console.warn("Notifications:", err.message);
      if (els.subtitle) els.subtitle.textContent = "Notifications indisponibles";
      return state.unread;
    }
  }

  async function loadList() {
    if (!els.list) return;
    els.list.innerHTML = '<div class="notif-loading">Chargement…</div>';
    try {
      const items = await MediCareAPI.getNotifications(state.filter);
      state.items = items;
      renderList(items);
      const unread = items.filter((n) => !Number(n.est_lu)).length;
      await refreshSummary();
      els.markAll.disabled = state.unread === 0;
      updateTabCounts();
    } catch (err) {
      els.list.innerHTML = `<div class="notif-error">${escapeHtml(err.message)}</div>`;
    }
  }

  function updateTabCounts() {
    const allCount = state.filter === "all" ? state.items.length : null;
    if (els.tabAllCount && allCount != null) {
      els.tabAllCount.textContent = allCount > 0 ? String(allCount) : "";
      els.tabAllCount.hidden = allCount === 0;
    }
    if (els.tabUnreadCount) {
      els.tabUnreadCount.textContent = state.unread > 0 ? String(state.unread) : "";
      els.tabUnreadCount.hidden = state.unread === 0;
    }
    if (els.subtitle) {
      els.subtitle.textContent =
        state.unread > 0
          ? `${state.unread} non lue${state.unread > 1 ? "s" : ""}`
          : "Tout est à jour";
    }
  }

  function renderList(items) {
    if (!items.length) {
      els.list.innerHTML = `
        <div class="notif-empty">
          <div class="notif-empty-icon">🔔</div>
          <h3>${state.filter === "unread" ? "Aucune notification non lue" : "Aucune notification"}</h3>
          <p>${state.filter === "unread" ? "Vous êtes à jour." : "Les alertes pharmacies et rappels apparaîtront ici."}</p>
        </div>`;
      return;
    }

    const groups = new Map();
    for (const n of items) {
      const label = groupLabel(n.date_creation);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(n);
    }

    let html = "";
    for (const [label, group] of groups) {
      html += `<div class="notif-group-label">${escapeHtml(label)}</div>`;
      html += group.map((n) => renderItem(n)).join("");
    }
    els.list.innerHTML = html;

    els.list.querySelectorAll(".notif-item").forEach((row) => {
      const id = row.dataset.id;
      const notif = items.find((x) => String(x.id) === id);
      row.addEventListener("click", (e) => {
        if (e.target.closest(".notif-item-dismiss")) return;
        handleItemClick(notif);
      });
      row.querySelector(".notif-item-dismiss")?.addEventListener("click", (e) => {
        e.stopPropagation();
        dismissItem(notif.id);
      });
    });
  }

  function renderItem(n) {
    const meta = TYPE_META[n.type] || TYPE_META.INFO;
    const unread = !Number(n.est_lu);
    const hasLink = !!resolveLink(n.lien);
    return `
      <article class="notif-item ${unread ? "is-unread" : ""}${hasLink ? " notif-item--has-link" : ""}" data-id="${n.id}" role="button" tabindex="0"${hasLink ? ' title="Ouvrir"' : ""}>
        <div class="notif-item-icon ${meta.class}" title="${meta.label}">${meta.iconHtml || meta.icon || "ℹ️"}</div>
        <div class="notif-item-body">
          <p class="notif-item-title">${escapeHtml(n.titre)}</p>
          <p class="notif-item-msg">${escapeHtml(formatNotificationMessage(n.message))}</p>
          <div class="notif-item-meta">
            ${unread ? '<span class="notif-item-dot" aria-hidden="true"></span>' : ""}
            <span>${formatRelative(n.date_creation)}</span>
            <span>·</span>
            <span>${meta.label}</span>
          </div>
        </div>
        <button type="button" class="notif-item-dismiss" aria-label="Supprimer">×</button>
      </article>`;
  }

  async function handleItemClick(n) {
    if (!Number(n.est_lu)) {
      try {
        await MediCareAPI.markNotificationRead(n.id);
        n.est_lu = true;
        await refreshSummary();
        if (state.open) await loadList();
      } catch {
        /* ignore */
      }
    }
    const url = resolveLink(n.lien);
    if (url) {
      close();
      window.location.href = url;
    }
  }

  async function dismissItem(id) {
    try {
      await MediCareAPI.deleteNotification(id);
      await loadList();
      await refreshSummary();
    } catch (err) {
      showToast({ type: "ALERT", titre: "Erreur", message: err.message });
    }
  }

  async function markAllRead() {
    try {
      await MediCareAPI.markAllNotificationsRead();
      await refreshSummary();
      await loadList();
    } catch (err) {
      showToast({ type: "ALERT", titre: "Erreur", message: err.message });
    }
  }

  function showToast({ type, titre, message, lien }) {
    if (!els.toastStack) return;
    const toast = document.createElement("div");
    toast.className = `notif-toast type-${(type || "INFO").toLowerCase()}`;
    toast.innerHTML = `<div><strong>${escapeHtml(titre)}</strong><span>${escapeHtml(formatNotificationMessage(message))}</span></div>`;
    toast.addEventListener("click", () => {
      if (lien) window.location.href = resolveLink(lien);
      else open();
      toast.remove();
    });
    els.toastStack.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }

  function open() {
    state.open = true;
    els.panel?.classList.add("is-open");
    els.backdrop?.classList.add("is-visible");
    els.bell?.classList.add("is-open");
    els.bell?.setAttribute("aria-expanded", "true");
    loadList();
  }

  function close() {
    state.open = false;
    els.panel?.classList.remove("is-open");
    els.backdrop?.classList.remove("is-visible");
    els.bell?.classList.remove("is-open");
    els.bell?.setAttribute("aria-expanded", "false");
  }

  function toggle() {
    if (state.open) close();
    else open();
  }

  function setFilter(filter) {
    state.filter = filter;
    els.tabs?.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.filter === filter);
    });
    loadList();
  }

  function mount(selector = "#notif-center-mount") {
    const root = document.querySelector(selector);
    if (!root) return;
    if (state.mounted && root.querySelector("#notif-bell")) return;

    root.innerHTML = `
      <button type="button" class="notif-bell" id="notif-bell" aria-label="Notifications" aria-expanded="false" aria-haspopup="true">
        ${BELL_SVG}
        <span class="notif-bell-badge is-hidden" id="notif-bell-badge"></span>
      </button>
      <div class="notif-backdrop" id="notif-backdrop" aria-hidden="true"></div>
      <div class="notif-panel" id="notif-panel" role="dialog" aria-labelledby="notif-panel-title" aria-modal="true">
        <div class="notif-panel-header">
          <div>
            <h2 id="notif-panel-title">Notifications</h2>
            <p class="notif-panel-sub" id="notif-panel-sub">Chargement…</p>
          </div>
          <div class="notif-panel-actions">
            <button type="button" class="notif-icon-btn" id="notif-close" aria-label="Fermer">✕</button>
          </div>
        </div>
        <div class="notif-tabs" role="tablist">
          <button type="button" class="notif-tab is-active" data-filter="all" role="tab">Toutes <span class="notif-tab-count" id="notif-tab-all-count" hidden></span></button>
          <button type="button" class="notif-tab" data-filter="unread" role="tab">Non lues <span class="notif-tab-count" id="notif-tab-unread-count" hidden></span></button>
        </div>
        <div class="notif-panel-toolbar">
          <button type="button" class="notif-mark-all" id="notif-mark-all">Tout marquer comme lu</button>
        </div>
        <div class="notif-list-scroll" id="notif-list" role="tabpanel"></div>
      </div>`;

    if (!document.getElementById("notif-toast-stack")) {
      const stack = document.createElement("div");
      stack.id = "notif-toast-stack";
      stack.className = "notif-toast-stack";
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }

    els = {
      bell: root.querySelector("#notif-bell"),
      badge: root.querySelector("#notif-bell-badge"),
      panel: root.querySelector("#notif-panel"),
      backdrop: root.querySelector("#notif-backdrop"),
      list: root.querySelector("#notif-list"),
      markAll: root.querySelector("#notif-mark-all"),
      subtitle: root.querySelector("#notif-panel-sub"),
      tabs: root.querySelectorAll(".notif-tab"),
      tabAllCount: root.querySelector("#notif-tab-all-count"),
      tabUnreadCount: root.querySelector("#notif-tab-unread-count"),
      toastStack: document.getElementById("notif-toast-stack"),
    };

    els.bell.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    });
    root.querySelector("#notif-close").addEventListener("click", close);
    els.backdrop.addEventListener("click", close);
    els.markAll.addEventListener("click", markAllRead);
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => setFilter(tab.dataset.filter));
    });

    document.addEventListener("click", (e) => {
      if (!state.open) return;
      if (!root.contains(e.target)) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.open) close();
    });

    state.mounted = true;
    refreshSummary();
    startPolling();
  }

  function startPolling() {
    stopPolling();
    state.lastUnread = state.unread;
    state.pollTimer = setInterval(() => refreshSummary(), 20000);
  }

  function stopPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  function init(selector) {
    mount(selector);
  }

  /** Recharge le badge et la liste (après ajout d’avis, favori, etc.). */
  async function refresh() {
    if (state.mounted && els.list) {
      await loadList();
      return;
    }
    await refreshSummary();
  }

  return { init, mount, open, close, refreshSummary, refresh, showToast, stopPolling };
})();

window.NotificationCenter = NotificationCenter;
