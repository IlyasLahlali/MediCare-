function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  if (window.NotificationCenter) NotificationCenter.stopPolling();
}

function requireUtilisateur() {
  const token = localStorage.getItem("token");
  const user = getStoredUser();
  if (!token || !user || user.role !== "UTILISATEUR") {
    window.location.href = pageUrl("Utilisateur/html/login.html");
    return null;
  }
  return user;
}

function logoutUtilisateur() {
  clearSession();
  window.location.href = pageUrl("Public/html/index.html");
}

function requireAdmin() {
  const token = localStorage.getItem("token");
  const user = getStoredUser();
  if (!token || !user || user.role !== "ADMIN") {
    window.location.href = pageUrl("Admin/html/login.html");
    return null;
  }
  return user;
}

function logoutAdmin() {
  clearSession();
  window.location.href = pageUrl("Admin/html/login.html");
}

function initAdminPage() {
  const user = requireAdmin();
  if (!user) return null;
  if (window.UserAccountMenu) UserAccountMenu.init();
  if (window.NotificationCenter) NotificationCenter.init("#notif-center-mount");
  document.getElementById("btn-logout")?.addEventListener("click", logoutAdmin);
  return user;
}

function redirectAfterLogin(user) {
  if (user.role === "UTILISATEUR") {
    window.location.href = pageUrl("Utilisateur/html/Dashboard.html");
    return;
  }
  if (user.role === "PHARMACIEN") {
    window.location.href = pageUrl("Pharmacien/html/Dashboard.html");
    return;
  }
  if (user.role === "ADMIN") {
    window.location.href = pageUrl("Admin/html/Dashboard.html");
    return;
  }
  window.location.href = pageUrl("Public/html/index.html");
}

function bindUserHeader(user) {
  const nameEl = document.getElementById("user-name");
  if (nameEl && user) nameEl.textContent = user.nom;
  if (window.UserAccountMenu) UserAccountMenu.init();
}

function setupUserHeaderActions() {
  document.getElementById("btn-logout")?.addEventListener("click", logoutUtilisateur);
}

function initUtilisateurPage() {
  const user = requireUtilisateur();
  if (!user) return null;
  bindUserHeader(user);
  if (!document.getElementById("user-account-menu-mount")) {
    setupUserHeaderActions();
  }
  if (window.NotificationCenter) {
    NotificationCenter.init("#notif-center-mount");
  }
  return user;
}
