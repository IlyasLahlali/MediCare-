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
      // resetLink renvoyé par l'API (mode dev) : on le remap vers la page Pharmacien.
      const token = new URL(data.resetLink, location.origin).searchParams.get("token") || "";
      const url = pageUrl(
        `Pharmacien/html/reinitialiser-mot-de-passe.html?token=${encodeURIComponent(token)}`
      );
      devEl.innerHTML = `
        <p><strong>Mode développement</strong></p>
        <p class="muted">${data.devNote || ""}</p>
        <p><a href="${url}" class="auth-link-btn">Ouvrir le lien de réinitialisation</a></p>
      `;
      devEl.hidden = false;
    }
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = "error";
    msgEl.hidden = false;
  }
});

