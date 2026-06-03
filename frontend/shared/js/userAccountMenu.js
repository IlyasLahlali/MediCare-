/**
 * Menu compte « app pro » : dropdown accessible, modale à onglets, chargement & focus.
 */
const UserAccountMenu = (() => {
  let bound = false;
  let profile = null;
  let lastFocused = null;
  let escapeHandlerBound = false;
  let zone = "Utilisateur";
  let logoutFn = null;
  let forgotUrl = "";
  let favorisUrl = "";

  const ICON = {
    user: '<svg class="user-account-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    shield: '<svg class="user-account-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    key: '<svg class="user-account-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
    logout: '<svg class="user-account-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    chevron: '<svg class="user-account-chevron-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    star: '<svg class="user-account-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  };

  function initials(nom) {
    const parts = String(nom || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function formatMemberSince(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);
    } catch {
      return "";
    }
  }

  function statutLabel(statut, role) {
    if (role !== "PHARMACIEN") return "";
    if (statut === "EN_ATTENTE") return "Compte en attente de validation";
    if (statut === "VALIDE") return "Compte validé";
    return "";
  }

  function ensureEscapeHandler() {
    if (escapeHandlerBound) return;
    escapeHandlerBound = true;
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const modal = document.getElementById("user-account-modal");
      if (modal?.classList.contains("is-open")) {
        e.preventDefault();
        closeModal();
        return;
      }
      closeDropdown();
    });
  }

  function ensureModal() {
    const existing = document.getElementById("user-account-modal");
    if (existing && !existing.querySelector("#user-account-profile-form")) {
      existing.remove();
    }
    if (document.getElementById("user-account-modal")) return;

    const modal = document.createElement("div");
    modal.id = "user-account-modal";
    modal.className = "user-account-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "user-account-modal-title");
    modal.innerHTML = `
      <div class="user-account-modal__backdrop" data-close-account-modal tabindex="-1"></div>
      <div class="user-account-modal__panel" role="document">
        <div class="user-account-modal__head">
          <div>
            <p class="user-account-modal__eyebrow">Paramètres du compte</p>
            <h2 id="user-account-modal-title">Mon compte</h2>
          </div>
          <button type="button" class="user-account-modal__close" data-close-account-modal aria-label="Fermer la fenêtre">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div class="user-account-tabs" role="tablist" aria-label="Sections du compte">
          <button type="button" class="user-account-tab is-active" role="tab" id="user-tab-profile" aria-selected="true" aria-controls="user-panel-profile" data-tab="profile" aria-label="Profil et adresse email" title="Profil et email">
            ${ICON.user}
            <span>Profil</span>
          </button>
          <button type="button" class="user-account-tab" role="tab" id="user-tab-security" aria-selected="false" aria-controls="user-panel-security" data-tab="security" tabindex="-1" aria-label="Sécurité et mot de passe" title="Sécurité">
            ${ICON.shield}
            <span>Sécurité</span>
          </button>
        </div>

        <div id="user-panel-profile" class="user-account-panel is-active" role="tabpanel" aria-labelledby="user-tab-profile">
          <div class="user-account-profile-card" id="user-account-profile-card">
            <div class="user-account-profile-row">
              <span class="user-account-profile-avatar-lg" id="user-account-profile-avatar-lg" aria-hidden="true">—</span>
              <div>
                <p id="user-account-profile-role" class="user-account-profile-role"></p>
                <p id="user-account-profile-statut" class="user-account-profile-meta muted" hidden></p>
              </div>
            </div>
          </div>

          <p class="user-account-section-title user-account-section-title--first">Informations du compte</p>
          <p class="user-account-hint user-account-hint--compact">
            Nom et email utilisés pour la connexion. Pour le mot de passe, utilisez l’onglet
            <button type="button" class="user-account-inline-tab" data-goto-tab="security">Sécurité</button>.
          </p>
          <form id="user-account-profile-form" class="user-account-form">
            <p id="user-account-profile-msg" class="user-account-msg" role="alert" hidden></p>
            <label>
              Nom complet
              <input type="text" name="nom" required minlength="2" autocomplete="name" />
            </label>
            <label>
              Adresse email
              <input type="email" name="email" required autocomplete="email" />
            </label>
            <button type="submit" class="btn btn-teal user-account-submit" data-default-label="Enregistrer">
              <span class="user-account-submit__text">Enregistrer</span>
              <span class="user-account-submit__load" hidden>Enregistrement…</span>
            </button>
          </form>
        </div>

        <div id="user-panel-security" class="user-account-panel" role="tabpanel" aria-labelledby="user-tab-security" hidden>
          <p class="user-account-section-title user-account-section-title--first">Mot de passe</p>
          <p class="user-account-hint user-account-hint--compact">
            ${
              forgotUrl
                ? `<a href="${escapeHtml(forgotUrl)}" class="user-account-link">Mot de passe oublié ?</a> Réinitialisation par lien sécurisé.`
                : `Changement disponible ici. Pour une réinitialisation, contactez le support.`
            }
          </p>
          <form id="user-account-password-form" class="user-account-form">
            <p id="user-account-password-msg" class="user-account-msg" role="alert" hidden></p>
            <label>
              Mot de passe actuel
              <input type="password" name="mot_de_passe_actuel" required autocomplete="current-password" />
            </label>
            <label>
              Nouveau mot de passe
              <input type="password" name="mot_de_passe_nouveau" required minlength="6" autocomplete="new-password" />
            </label>
            <label>
              Confirmer le nouveau mot de passe
              <input type="password" name="mot_de_passe_confirm" required minlength="6" autocomplete="new-password" />
            </label>
            <button type="submit" class="btn btn-teal user-account-submit" data-default-label="Mettre à jour le mot de passe">
              <span class="user-account-submit__text">Mettre à jour le mot de passe</span>
              <span class="user-account-submit__load" hidden>Mise à jour…</span>
            </button>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll("[data-close-account-modal]").forEach((el) => {
      el.addEventListener("click", closeModal);
    });

    modal.querySelectorAll("[data-tab]").forEach((tab) => {
      tab.addEventListener("click", () => setModalTab(tab.dataset.tab));
      tab.addEventListener("keydown", (e) => {
        const tabs = [...modal.querySelectorAll("[data-tab]")];
        const i = tabs.indexOf(e.currentTarget);
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          const next = tabs[(i + 1) % tabs.length];
          next.focus();
          setModalTab(next.dataset.tab);
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          const prev = tabs[(i - 1 + tabs.length) % tabs.length];
          prev.focus();
          setModalTab(prev.dataset.tab);
        }
      });
    });

    document.getElementById("user-account-profile-form").addEventListener("submit", onProfileSubmit);
    document.getElementById("user-account-password-form").addEventListener("submit", onPasswordSubmit);
    modal.querySelectorAll("[data-goto-tab]").forEach((btn) => {
      btn.addEventListener("click", () => setModalTab(btn.dataset.gotoTab));
    });
    ensureEscapeHandler();
  }

  function setModalTab(tabKey) {
    const modal = document.getElementById("user-account-modal");
    if (!modal) return;
    modal.querySelectorAll("[data-tab]").forEach((t) => {
      const active = t.dataset.tab === tabKey;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
      t.setAttribute("tabindex", active ? "0" : "-1");
    });
    modal.querySelectorAll(".user-account-panel").forEach((p) => {
      const id = p.id;
      const show =
        (tabKey === "profile" && id === "user-panel-profile") ||
        (tabKey === "security" && id === "user-panel-security");
      p.classList.toggle("is-active", show);
      p.hidden = !show;
    });
  }

  function openModal(options = {}) {
    ensureModal();
    closeDropdown();
    lastFocused = document.activeElement;
    fillProfileCard();
    setModalTab(options.tab === "security" ? "security" : "profile");
    const modal = document.getElementById("user-account-modal");
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      if (options.tab === "security") {
        document.querySelector("#user-account-password-form [name=mot_de_passe_actuel]")?.focus();
      } else {
        document.querySelector("#user-account-profile-form [name=nom]")?.focus();
      }
    });
  }

  function closeModal() {
    const modal = document.getElementById("user-account-modal");
    modal?.classList.remove("is-open");
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") {
      try {
        lastFocused.focus();
      } catch {
        /* ignore */
      }
    }
    lastFocused = null;
  }

  function fillProfileCard() {
    const user = profile || getStoredUser();
    if (!user) return;
    const av = document.getElementById("user-account-profile-avatar-lg");
    if (av) av.textContent = initials(user.nom);
    const roleEl = document.getElementById("user-account-profile-role");
    if (roleEl) {
      const since = formatMemberSince(user.date_creation);
      roleEl.textContent = since ? `Membre depuis ${since}` : "";
      roleEl.hidden = !since;
    }
    const statutEl = document.getElementById("user-account-profile-statut");
    const statutText = statutLabel(user.statut, user.role);
    if (statutEl) {
      statutEl.textContent = statutText;
      statutEl.hidden = !statutText;
    }
    const nomInput = document.querySelector("#user-account-profile-form [name=nom]");
    const emailInput = document.querySelector("#user-account-profile-form [name=email]");
    if (nomInput) nomInput.value = user.nom || "";
    if (emailInput) emailInput.value = user.email || "";
  }

  function showFormMsg(id, text, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = `user-account-msg ${type}`;
    el.hidden = !text;
  }

  function setSubmitLoading(form, loading) {
    const btn = form.querySelector(".user-account-submit");
    if (!btn) return;
    const text = btn.querySelector(".user-account-submit__text");
    const load = btn.querySelector(".user-account-submit__load");
    btn.disabled = loading;
    if (text) text.hidden = loading;
    if (load) load.hidden = !loading;
  }

  async function refreshProfile() {
    try {
      profile = await MediCareAPI.me();
      const stored = getStoredUser();
      if (stored && profile) {
        saveSession(localStorage.getItem("token"), {
          ...stored,
          nom: profile.nom,
          email: profile.email,
          statut: profile.statut,
          date_creation: profile.date_creation,
        });
      }
      updateTriggerLabel(profile || getStoredUser());
      updateMenuHead(profile || getStoredUser());
      fillProfileCard();
    } catch {
      profile = getStoredUser();
    }
  }

  function updateTriggerLabel(user) {
    const label = document.querySelector(".user-account-label");
    const avatar = document.querySelector(".user-account-avatar");
    if (label && user) label.textContent = user.nom;
    if (avatar && user) avatar.textContent = initials(user.nom);
  }

  function updateMenuHead(user) {
    if (!user) return;
    const head = document.querySelector(".user-account-menu-head");
    if (!head) return;
    const strong = head.querySelector("strong");
    const span = head.querySelector(".user-account-menu-email");
    if (strong) strong.textContent = user.nom;
    if (span) span.textContent = user.email || "";
  }

  async function onProfileSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const nom = String(fd.get("nom") || "").trim();
    const email = String(fd.get("email") || "").trim();
    showFormMsg("user-account-profile-msg", "", "");
    setSubmitLoading(form, true);
    try {
      const data = await MediCareAPI.updateProfile(nom, email);
      if (data.user) {
        const token = localStorage.getItem("token");
        saveSession(token, {
          ...getStoredUser(),
          ...data.user,
          date_creation: data.user.date_creation || profile?.date_creation,
        });
        profile = { ...profile, ...data.user };
        updateTriggerLabel(data.user);
        updateMenuHead(data.user);
        fillProfileCard();
      }
      showFormMsg("user-account-profile-msg", data.message || "Profil mis à jour.", "success");
    } catch (err) {
      showFormMsg("user-account-profile-msg", err.message, "error");
    } finally {
      setSubmitLoading(form, false);
    }
  }

  async function onPasswordSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const actuel = fd.get("mot_de_passe_actuel");
    const nouveau = fd.get("mot_de_passe_nouveau");
    const confirm = fd.get("mot_de_passe_confirm");
    showFormMsg("user-account-password-msg", "", "");
    if (nouveau !== confirm) {
      showFormMsg("user-account-password-msg", "Les mots de passe ne correspondent pas.", "error");
      return;
    }
    setSubmitLoading(form, true);
    try {
      const data = await MediCareAPI.updatePassword(actuel, nouveau);
      showFormMsg("user-account-password-msg", data.message || "Mot de passe mis à jour.", "success");
      form.reset();
    } catch (err) {
      showFormMsg("user-account-password-msg", err.message, "error");
    } finally {
      setSubmitLoading(form, false);
    }
  }

  function closeDropdown() {
    const menu = document.querySelector(".user-account-menu");
    const btn = document.querySelector(".user-account-trigger");
    menu?.classList.remove("is-open");
    btn?.setAttribute("aria-expanded", "false");
  }

  function openDropdown() {
    const menu = document.querySelector(".user-account-menu");
    const btn = document.querySelector(".user-account-trigger");
    if (!menu || !btn) return;
    menu.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    const first = menu.querySelector('.user-account-menu-item[role="menuitem"], a.user-account-menu-item');
    first?.focus();
  }

  function toggleDropdown() {
    const menu = document.querySelector(".user-account-menu");
    if (!menu) return;
    if (menu.classList.contains("is-open")) closeDropdown();
    else openDropdown();
  }

  function renderMount(mount, user) {
    mount.innerHTML = `
      <div class="user-account-wrap">
        <button type="button" class="user-account-trigger" id="user-account-trigger"
          aria-expanded="false"
          aria-haspopup="menu"
          aria-controls="user-account-menu"
          title="Menu compte — ${escapeHtml(user.nom)}">
          <span class="user-account-avatar" aria-hidden="true">${initials(user.nom)}</span>
          <span class="user-account-label">${escapeHtml(user.nom)}</span>
          ${ICON.chevron}
        </button>
        <div class="user-account-menu" id="user-account-menu" role="menu" aria-labelledby="user-account-trigger">
          <div class="user-account-menu-head">
            <strong>${escapeHtml(user.nom)}</strong>
            <span class="user-account-menu-email">${escapeHtml(user.email || "")}</span>
          </div>
          <button type="button" class="user-account-menu-item" data-action="account" role="menuitem">
            ${ICON.user}
            <span>Mon compte</span>
          </button>
          <button type="button" class="user-account-menu-item" data-action="password" role="menuitem">
            ${ICON.shield}
            <span>Sécurité & mot de passe</span>
          </button>
          ${
            favorisUrl
              ? `<a href="${escapeHtml(favorisUrl)}" class="user-account-menu-item" role="menuitem">
            ${ICON.star}
            <span>Mes favoris</span>
          </a>`
              : ""
          }
          ${
            forgotUrl
              ? `<a href="${escapeHtml(forgotUrl)}" class="user-account-menu-item" role="menuitem">
            ${ICON.key}
            <span>Mot de passe oublié</span>
          </a>`
              : ""
          }
          <div class="user-account-menu-divider"></div>
          <button type="button" class="user-account-menu-item user-account-menu-item--danger" data-action="logout" role="menuitem">
            ${ICON.logout}
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>
    `;

    const trigger = mount.querySelector("#user-account-trigger");
    const menu = mount.querySelector("#user-account-menu");

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDropdown();
    });

    trigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!menu.classList.contains("is-open")) openDropdown();
      }
    });

    menu.addEventListener("keydown", (e) => {
      const items = [...menu.querySelectorAll('.user-account-menu-item[role="menuitem"], a.user-account-menu-item')];
      const i = items.indexOf(document.activeElement);
      if (e.key === "Escape") {
        e.preventDefault();
        closeDropdown();
        trigger.focus();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = items[(i + 1) % items.length];
        next?.focus();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = items[(i - 1 + items.length) % items.length];
        prev?.focus();
      }
      if (e.key === "Home") {
        e.preventDefault();
        items[0]?.focus();
      }
      if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1]?.focus();
      }
    });

    mount.querySelector('[data-action="account"]')?.addEventListener("click", () => {
      openModal({ tab: "profile" });
    });

    mount.querySelector('[data-action="password"]')?.addEventListener("click", () => {
      openModal({ tab: "security" });
    });

    mount.querySelector('[data-action="logout"]')?.addEventListener("click", () => {
      closeDropdown();
      if (typeof logoutFn === "function") logoutFn();
    });

    document.addEventListener(
      "click",
      (e) => {
        if (!e.target.closest(".user-account-wrap")) closeDropdown();
      },
      true
    );
  }

  function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text ?? "";
    return d.innerHTML;
  }

  function ensureAccountCss() {
    if (document.querySelector('link[data-mc-account="1"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    const base = document.querySelector('script[src*="common.js"]')?.src || location.href;
    link.href = new URL("../../shared/css/userAccount.css", base).href;
    link.dataset.mcAccount = "1";
    document.head.appendChild(link);
  }

  function init() {
    if (bound) return;
    const user = getStoredUser();
    if (!user || (user.role !== "UTILISATEUR" && user.role !== "PHARMACIEN" && user.role !== "ADMIN")) return;

    const mount = document.getElementById("user-account-menu-mount");
    if (!mount) return;

    zone = user.role === "PHARMACIEN" ? "Pharmacien" : user.role === "ADMIN" ? "Admin" : "Utilisateur";
    forgotUrl =
      user.role === "UTILISATEUR" || user.role === "PHARMACIEN"
        ? pageUrl(`${zone}/html/mot-de-passe-oublie.html`)
        : "";
    favorisUrl = user.role === "UTILISATEUR" ? pageUrl("Utilisateur/html/pharmacieFavories.html") : "";
    logoutFn =
      user.role === "PHARMACIEN"
        ? window.logoutPharmacien
        : user.role === "ADMIN"
          ? window.logoutAdmin
          : window.logoutUtilisateur;

    ensureAccountCss();
    renderMount(mount, user);
    ensureModal();
    refreshProfile();
    bound = true;
  }

  return { init, refreshProfile, openModal };
})();

window.UserAccountMenu = UserAccountMenu;
