/** Menu mobile + lien actif pour headers .app-header */
function initAppHeader() {
  const header = document.querySelector(".app-header");
  if (!header) return;

  const page = location.pathname.split("/").pop()?.replace(/\.html$/i, "") || "";
  const zone = header.dataset.zone || "";
  const hash = (location.hash || "").replace(/^#/, "");

  let activePage = page;
  if (page === "pharmacieDetail") {
    if (zone === "pharmacien") activePage = "pharmacie";
    else if (zone === "utilisateur") activePage = "Dashboard";
    else activePage = "pharmacies-proches";
  }
  if (hash === "pharmacies-proches") activePage = "pharmacies-proches";
  if (hash === "hero-search") activePage = "hero-search";
  if (hash === "mc-zone-footer") activePage = "contact";

  header.querySelectorAll("[data-nav-page]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.navPage === activePage);
  });

  header.querySelectorAll('a[href*="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const url = new URL(link.href, location.href);
      if (url.pathname !== location.pathname && url.pathname.endsWith(".html")) return;

      const targetId = url.hash.replace(/^#/, "");
      if (!targetId) return;

      const target = document.getElementById(targetId);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${targetId}`);
      header.classList.remove("is-menu-open");
      header.querySelector("#header-menu-toggle")?.setAttribute("aria-expanded", "false");
      header.querySelectorAll(".header-nav-link[data-nav-page]").forEach((navLink) => {
        navLink.classList.toggle("is-active", navLink.dataset.navPage === link.dataset.navPage);
      });
    });
  });

  const toggle = header.querySelector("#header-menu-toggle");
  const nav = header.querySelector("#header-main-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const open = header.classList.toggle("is-menu-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  nav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      header.classList.remove("is-menu-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      header.classList.remove("is-menu-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  if (hash) {
    const target = document.getElementById(hash);
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }
}
