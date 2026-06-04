const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");
const { loadPharmacySchema } = require("./utils/pharmacySchema");
const pharmacieRoutes = require("./routes/pharmacieRoutes");
const medicamentRoutes = require("./routes/medicamentRoutes");
const stockRoutes = require("./routes/stockRoutes");
const authRoutes = require("./routes/authRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const favorisRoutes = require("./routes/favorisRoutes");
const avisRoutes = require("./routes/avisRoutes");
const statistiqueRoutes = require("./routes/statistiqueRoutes");
const pharmacienRoutes = require("./routes/pharmacienRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { startGardeReminderScheduler } = require("./utils/gardeReminderScheduler");
const { syncGardeFlagsFromPlanning } = require("./utils/gardeService");

const app = express();
const PORT = process.env.PORT || 3000;
const frontendPath = path.join(__dirname, "..", "frontend");

app.use(cors());
app.use(express.json({ limit: "8mb" }));
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const uploadsPath = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath));

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    const relational = await refreshHorairesSqlMode();
    res.json({
      ok: true,
      database: "connected",
      horaires_relational: relational,
      fermeture_manuelle: !!pharmacienRoutes.features?.manualClose,
    });
  } catch (err) {
    console.error(err);
    res.status(503).json({ ok: false, error: "Base de données indisponible" });
  }
});

app.use("/api", async (req, res, next) => {
  if (req.path === "/health") return next();
  try {
    await ensurePharmacyHorairesTablesSchemaOnce();
    next();
  } catch (err) {
    console.error("Schéma horaires:", err.message);
    res.status(503).json({
      error: "Schéma horaires indisponible — redémarrez le serveur (npm start)",
      detail: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
});

app.use("/api/pharmacies", pharmacieRoutes);
app.use("/api/medicaments", medicamentRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/favoris", favorisRoutes);
app.use("/api/avis", avisRoutes);
app.use("/api/stats", statistiqueRoutes);
app.use("/api/pharmacien", pharmacienRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "Route API introuvable",
    path: req.originalUrl,
    hint: "Redémarrez le backend si une fonction récente renvoie 404.",
  });
});

app.get("/", (req, res) => {
  res.redirect(302, "/Public/html/index.html");
});

app.use(
  express.static(frontendPath, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".webmanifest")) {
        res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      }
      if (filePath.endsWith("sw.js")) {
        res.setHeader("Service-Worker-Allowed", "/");
      }
    },
  })
);

const { ensureNotificationsSchema } = require("./utils/ensureNotificationsSchema");
const { ensureGoogleAuthSchema } = require("./utils/ensureGoogleAuthSchema");
const { ensureStockPharmacieSchema } = require("./utils/ensureStockPharmacieSchema");
const {
  ensurePharmacyHorairesTablesSchema,
  ensurePharmacyHorairesTablesSchemaOnce,
  refreshHorairesSqlMode,
} = require("./utils/pharmacyHorairesDb");
const { ensurePharmacyStatutAdminSchema } = require("./utils/ensurePharmacyStatutAdminSchema");
const { invalidatePharmacySchemaCache } = require("./utils/pharmacySchema");

ensurePharmacyStatutAdminSchema()
  .then(() => {
    invalidatePharmacySchemaCache();
    return loadPharmacySchema();
  })
  .then(() => ensureNotificationsSchema())
  .then(() => ensureGoogleAuthSchema())
  .then(() => ensureStockPharmacieSchema())
  .then(() => ensurePharmacyHorairesTablesSchema())
  .then(() =>
    syncGardeFlagsFromPlanning().catch((err) =>
      console.warn("Sync garde au démarrage:", err.message)
    )
  )
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`MediCare+ → port ${PORT} (0.0.0.0)`);
      console.log(
        pharmacienRoutes.features?.manualClose
          ? "Fermeture manuelle : routes marquer-ferme / marquer-ouverte actives"
          : "ATTENTION — routes fermeture manuelle absentes (redémarrez depuis le bon dossier backend)"
      );
      startGardeReminderScheduler();
    });
  })
  .catch((err) => {
    console.error("Démarrage impossible:", err.message);
    if (process.env.NODE_ENV === "production") {
      console.error(
        "Railway : ajoutez DATABASE_URL (réf. MySQL) + importez BaseDonnee_railway.sql dans Workbench."
      );
    } else {
      console.error("Local : MySQL démarré, backend/.env, BaseDonnee.sql exécuté.");
    }
    process.exit(1);
  });
