document.getElementById("reset-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = new URLSearchParams(location.search).get("token");
  const msgEl = document.getElementById("reset-msg");
  const pwd = document.getElementById("password").value;
  const confirm = document.getElementById("password-confirm").value;

  msgEl.hidden = true;
  if (!token) {
    msgEl.textContent = "Lien invalide. Demandez une nouvelle réinitialisation.";
    msgEl.className = "error";
    msgEl.hidden = false;
    return;
  }
  if (pwd !== confirm) {
    msgEl.textContent = "Les mots de passe ne correspondent pas.";
    msgEl.className = "error";
    msgEl.hidden = false;
    return;
  }

  try {
    const data = await MediCareAPI.resetPassword(token, pwd);
    msgEl.textContent = data.message || "Mot de passe enregistré.";
    msgEl.className = "success";
    msgEl.hidden = false;
    e.target.querySelector("button[type=submit]").disabled = true;
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = "error";
    msgEl.hidden = false;
  }
});
