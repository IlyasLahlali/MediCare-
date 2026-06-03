document.addEventListener("DOMContentLoaded", () => {
  const user = getStoredUser();
  if (user?.role === "ADMIN" && localStorage.getItem("token")) {
    window.location.href = pageUrl("Admin/html/Dashboard.html");
    return;
  }

  const form = document.getElementById("login-form");
  const errEl = document.getElementById("login-error");
  const submitBtn = document.getElementById("login-submit");
  const submitText = submitBtn?.querySelector(".admin-login-submit-text");
  const submitSpinner = submitBtn?.querySelector(".admin-login-submit-spinner");
  const pwdInput = document.getElementById("password");
  const togglePwd = document.getElementById("toggle-password");

  togglePwd?.addEventListener("click", () => {
    const show = pwdInput.type === "password";
    pwdInput.type = show ? "text" : "password";
    togglePwd.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
    togglePwd.querySelector(".icon-eye").hidden = !show;
    togglePwd.querySelector(".icon-eye-off").hidden = show;
  });

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    if (submitText) submitText.hidden = loading;
    if (submitSpinner) submitSpinner.hidden = !loading;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    setLoading(true);
    try {
      const data = await MediCareAPI.login(
        document.getElementById("email").value.trim(),
        document.getElementById("password").value
      );
      if (data.user.role !== "ADMIN") {
        throw new Error("Accès réservé aux administrateurs");
      }
      saveSession(data.token, data.user);
      redirectAfterLogin(data.user);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
      setLoading(false);
    }
  });
});
