document.addEventListener("DOMContentLoaded", () => {
  const user = getStoredUser();
  if (user?.role === "UTILISATEUR" && localStorage.getItem("token")) {
    window.location.href = pageUrl("Utilisateur/html/Dashboard.html");
    return;
  }

  const urlErr = new URLSearchParams(location.search).get("google_error");
  if (urlErr) {
    const errEl = document.getElementById("login-error");
    if (errEl) {
      errEl.textContent = decodeURIComponent(urlErr);
      errEl.hidden = false;
    }
    history.replaceState(null, "", location.pathname);
  }

  GoogleAuth.initButton({
    errorElId: "login-error",
    nextPath: "/Utilisateur/html/Dashboard.html",
  }).catch((err) => {
    const errEl = document.getElementById("login-error");
    if (errEl && err?.message) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });

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
