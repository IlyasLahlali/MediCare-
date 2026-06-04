function bindPharmaContactScroll() {
  document
    .querySelector('.app-header[data-zone="pharmacien"] a[data-nav-page="contact"]')
    ?.addEventListener("click", () => {
      const footer = document.getElementById("mc-zone-footer");
      if (!footer) return;
      const contactCol = footer.querySelector("#pharma-footer-contact");
      contactCol?.classList.add("pharma-footer-highlight");
      setTimeout(() => contactCol?.classList.remove("pharma-footer-highlight"), 2200);
    });
}

document.addEventListener("medicare-layout-ready", () => {
  bindPharmaContactScroll();
});
