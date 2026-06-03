function resolveApiBase() {
  if (location.port === "5500" || location.port === "5501") {
    return "http://localhost:3000/api";
  }
  if (location.hostname === "localhost" && location.port && location.port !== "3000") {
    return "http://localhost:3000/api";
  }
  return `${location.origin}/api`;
}

const API = resolveApiBase();

async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    if (!navigator.onLine) {
      throw new Error(
        "Vous êtes hors ligne. Les pharmacies déjà consultées peuvent s'afficher si vous les avez ouvertes une fois en ligne."
      );
    }
    throw new Error(
      "Serveur injoignable. Lancez « npm start » dans le dossier backend puis ouvrez http://localhost:3000"
    );
  }

  const data = await res.json().catch(() => ({}));
  if (res.headers.get("X-MediCare-Offline") === "1") {
    data._offlineCache = true;
  }
  if (!res.ok) {
    if (res.status === 503 && data.error) {
      throw new Error(data.error);
    }
    if (res.status === 503 && data.ok === false) {
      throw new Error(
        data.error ||
          "Base de données indisponible — vérifiez MySQL et backend/.env"
      );
    }
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return data;
}

window.MediCareAPI = {
  health: () => apiFetch("/health"),
  getPharmacyFilters: (ville) => {
    const q = ville ? `?ville=${encodeURIComponent(ville)}` : "";
    return apiFetch(`/pharmacies/filtres${q}`);
  },
  getVilleAuto: (lat, lon) =>
    apiFetch(`/pharmacies/ville-auto?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`),
  getPublicStats: () => apiFetch("/pharmacies/public-stats"),
  getPharmacies: (params = {}) => {
    const q = new URLSearchParams();
    if (params.ouvertes) q.set("ouvertes", "1");
    if (params.lat != null) q.set("lat", params.lat);
    if (params.lon != null) q.set("lon", params.lon);
    if (params.nom) q.set("nom", params.nom);
    if (params.quartier) q.set("quartier", params.quartier);
    if (params.ville) q.set("ville", params.ville);
    const qs = q.toString();
    return apiFetch(qs ? `/pharmacies?${qs}` : "/pharmacies");
  },
  getPharmacy: (id, params = {}) => {
    const q = new URLSearchParams();
    if (params.lat != null) q.set("lat", params.lat);
    if (params.lon != null) q.set("lon", params.lon);
    const qs = q.toString();
    return apiFetch(qs ? `/pharmacies/${id}?${qs}` : `/pharmacies/${id}`);
  },
  searchMedicaments: (query, pharmacyId) => {
    const q = new URLSearchParams({ q: query });
    if (pharmacyId) q.set("pharmacyId", pharmacyId);
    return apiFetch(`/medicaments/search?${q}`);
  },
  getStock: (pharmacyId) => apiFetch(`/stock/pharmacie/${pharmacyId}`),

  getGoogleClientId: () => apiFetch("/auth/google/client-id"),
  loginWithGoogle: (credential) =>
    apiFetch("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
  login: (email, mot_de_passe) =>
    apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, mot_de_passe }),
    }),
  register: (body) =>
    apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => apiFetch("/auth/me"),
  updateProfile: (nom, email) =>
    apiFetch("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ nom, email }),
    }),
  updateEmail: (email, mot_de_passe) =>
    apiFetch("/auth/email", {
      method: "PATCH",
      body: JSON.stringify(
        mot_de_passe != null && mot_de_passe !== ""
          ? { email, mot_de_passe }
          : { email }
      ),
    }),
  updatePassword: (mot_de_passe_actuel, mot_de_passe_nouveau) =>
    apiFetch("/auth/password", {
      method: "PATCH",
      body: JSON.stringify({ mot_de_passe_actuel, mot_de_passe_nouveau }),
    }),
  forgotPassword: (email) =>
    apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token, mot_de_passe_nouveau) =>
    apiFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, mot_de_passe_nouveau }),
    }),

  getNotificationSummary: () => apiFetch("/notifications/summary"),
  getNotifications: (filter = "all") => {
    const q = filter === "unread" ? "?filter=unread" : "";
    return apiFetch(`/notifications${q}`);
  },
  markNotificationRead: (id) =>
    apiFetch(`/notifications/${id}/lu`, { method: "PATCH" }),
  markAllNotificationsRead: () =>
    apiFetch("/notifications/read-all", { method: "PATCH" }),
  deleteNotification: (id) =>
    apiFetch(`/notifications/${id}`, { method: "DELETE" }),

  getFavoris: () => apiFetch("/favoris"),
  checkFavori: (pharmacyId) => apiFetch(`/favoris/check/${pharmacyId}`),
  toggleFavori: (pharmacyId) =>
    apiFetch(`/favoris/${pharmacyId}`, { method: "POST" }),

  getAvisPharmacie: (pharmacyId) => apiFetch(`/avis/pharmacie/${pharmacyId}`),
  getMonAvis: (pharmacyId) => apiFetch(`/avis/pharmacie/${pharmacyId}/mine`),
  postAvis: (pharmacyId, note, commentaire) =>
    apiFetch(`/avis/pharmacie/${pharmacyId}`, {
      method: "POST",
      body: JSON.stringify({ note, commentaire }),
    }),

  trackStat: (pharmacyId, type) =>
    apiFetch("/stats/track", {
      method: "POST",
      body: JSON.stringify({ pharmacyId, type }),
    }),

  getPharmaDashboard: (days = 7) =>
    apiFetch(`/stats/dashboard?days=${days}`),

  getPharmaPharmacies: (q) => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return apiFetch(`/pharmacien/pharmacies${qs}`);
  },
  getPharmaPharmacy: (id) => apiFetch(`/pharmacien/pharmacies/${id}`),
  createPharmaPharmacy: (body) =>
    apiFetch("/pharmacien/pharmacies", { method: "POST", body: JSON.stringify(body) }),
  pharmaGeocodeReverse: (lat, lon) =>
    apiFetch(
      `/pharmacien/geocode-reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
    ),
  updatePharmaPharmacy: (id, body) =>
    apiFetch(`/pharmacien/pharmacies/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePharmaPharmacy: (id) =>
    apiFetch(`/pharmacien/pharmacies/${id}`, { method: "DELETE" }),

  getPharmaStock: (pharmacyId) => apiFetch(`/pharmacien/pharmacies/${pharmacyId}/stock`),
  addPharmaStock: (pharmacyId, body) =>
    apiFetch(`/pharmacien/pharmacies/${pharmacyId}/stock`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePharmaStock: (stockId, body) =>
    apiFetch(`/pharmacien/stock/${stockId}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePharmaStock: (stockId) =>
    apiFetch(`/pharmacien/stock/${stockId}`, { method: "DELETE" }),
  searchMedicamentsCatalog: (q) =>
    apiFetch(`/pharmacien/medicaments/search?q=${encodeURIComponent(q)}`),

  getGardeSummary: () => apiFetch("/pharmacien/garde"),
  activateGarde: (pharmacyId, body) =>
    apiFetch(`/pharmacien/pharmacies/${pharmacyId}/garde/activate`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deactivateGarde: (pharmacyId) =>
    apiFetch(`/pharmacien/pharmacies/${pharmacyId}/garde/deactivate`, {
      method: "POST",
    }),

  getAdminStats: () => apiFetch("/admin/stats"),
  getAdminPharmacies: (statut = "", limit = 0) => {
    const q = new URLSearchParams();
    if (statut) q.set("statut", statut);
    if (limit > 0) q.set("limit", String(limit));
    const qs = q.toString();
    return apiFetch(`/admin/pharmacies/list${qs ? `?${qs}` : ""}`);
  },
  searchAdminPharmacies: ({ pharmacien = "", pharmacie = "", ville = "" } = {}) => {
    const q = new URLSearchParams();
    if (pharmacien.trim()) q.set("pharmacien", pharmacien.trim());
    if (pharmacie.trim()) q.set("pharmacie", pharmacie.trim());
    if (ville.trim()) q.set("ville", ville.trim());
    return apiFetch(`/admin/pharmacies/search?${q}`);
  },
  getAdminPharmacy: (id) => apiFetch(`/admin/pharmacies/${id}`),
  validateAdminPharmacy: (id) =>
    apiFetch(`/admin/pharmacies/${id}/valider`, { method: "PUT" }),
  refuseAdminPharmacy: (id) =>
    apiFetch(`/admin/pharmacies/${id}/refuser`, { method: "PUT" }),
};
