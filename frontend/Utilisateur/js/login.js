document.addEventListener("DOMContentLoaded", () => {
  const user = getStoredUser();
  if (user?.role === "UTILISATEUR" && localStorage.getItem("token")) {
    window.location.href = pageUrl("Utilisateur/html/Dashboard.html");
    return;
  }

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("login-error");
    errEl.hidden = true;
    try {
      const data = await MediCareAPI.login(
        document.getElementById("email").value.trim(),
        document.getElementById("password").value
      );
      saveSession(data.token, data.user);
      redirectAfterLogin(data.user);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
});
