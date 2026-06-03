document.getElementById("forgot-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const msgEl = document.getElementById("forgot-msg");
  const devEl = document.getElementById("forgot-dev-link");
  msgEl.hidden = true;
  devEl.hidden = true;

  try {
    const data = await MediCareAPI.forgotPassword(email);
    msgEl.textContent = data.message || "Demande enregistrée.";
    msgEl.className = "success";
    msgEl.hidden = false;

    if (data.resetLink) {
      const full = data.resetLink.startsWith("http")
        ? data.resetLink
        : pageUrl(data.resetLink.replace(/^\//, ""));
      devEl.innerHTML = `
        <p><strong>Mode développement</strong></p>
        <p class="muted">${data.devNote || ""}</p>
        <p><a href="${full}" class="auth-link-btn">Ouvrir le lien de réinitialisation</a></p>
      `;
      devEl.hidden = false;
    }
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = "error";
    msgEl.hidden = false;
  }
});
