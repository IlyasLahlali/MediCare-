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

const uploadsPath = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath));

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    console.error(err);
    res.status(503).json({ ok: false, error: "Base de données indisponible" });
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

loadPharmacySchema()
  .then(() => ensureNotificationsSchema())
  .then(() =>
    syncGardeFlagsFromPlanning().catch((err) =>
      console.warn("Sync garde au démarrage:", err.message)
    )
  )
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`MediCare+ → port ${PORT} (0.0.0.0)`);
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
