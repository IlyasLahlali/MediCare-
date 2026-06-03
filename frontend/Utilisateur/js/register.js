document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("register-error");
    errEl.hidden = true;

    const pwd = document.getElementById("password").value;
    const confirm = document.getElementById("password-confirm").value;
    if (pwd !== confirm) {
      errEl.textContent = "Les mots de passe ne correspondent pas.";
      errEl.hidden = false;
      return;
    }

    try {
      await MediCareAPI.register({
        nom: document.getElementById("nom").value.trim(),
        email: document.getElementById("email").value.trim(),
        mot_de_passe: pwd,
        role: "UTILISATEUR",
      });
      const data = await MediCareAPI.login(
        document.getElementById("email").value.trim(),
        pwd
      );
      saveSession(data.token, data.user);
      redirectAfterLogin(data.user);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
});
