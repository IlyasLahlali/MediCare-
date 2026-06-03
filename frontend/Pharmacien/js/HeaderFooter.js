function bindPharmaContactScroll() {
  document.getElementById("btn-contact-header")?.addEventListener("click", (e) => {
    const footer = document.getElementById("mc-zone-footer");
    if (!footer) return;
    e.preventDefault();
    footer.scrollIntoView({ behavior: "smooth", block: "start" });
    const contactCol = footer.querySelector("#pharma-footer-contact");
    contactCol?.classList.add("pharma-footer-highlight");
    setTimeout(() => contactCol?.classList.remove("pharma-footer-highlight"), 2200);
  });
}

document.addEventListener("medicare-layout-ready", () => {
  bindPharmaContactScroll();
});
