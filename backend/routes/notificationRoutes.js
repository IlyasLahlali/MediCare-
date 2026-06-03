const express = require("express");
const pool = require("../config/db");
const { authRequired } = require("../middleware/authMiddleware");
const { ensureNotificationsSchema } = require("../utils/ensureNotificationsSchema");

const router = express.Router();

router.use(authRequired);

router.use(async (req, res, next) => {
  try {
    await ensureNotificationsSchema();
    next();
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: "Notifications indisponibles (base de données)" });
  }
});

const SELECT_FIELDS = `id, titre, message, type, lien, est_lu, date_creation`;

router.get("/summary", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN COALESCE(est_lu, 0) = 0 THEN 1 ELSE 0 END) AS unread
       FROM notifications WHERE id_utilisateur = ?`,
      [req.user.id]
    );
    res.json({
      total: Number(rows[0].total) || 0,
      unread: Number(rows[0].unread) || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/", async (req, res) => {
  const filter = req.query.filter === "unread" ? "unread" : "all";
  try {
    const [rows] = await pool.query(
      `SELECT ${SELECT_FIELDS}
       FROM notifications
       WHERE id_utilisateur = ?${filter === "unread" ? " AND COALESCE(est_lu, 0) = 0" : ""}
       ORDER BY date_creation DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    if (err.code === "ER_BAD_FIELD_ERROR") {
      const [rows] = await pool.query(
        `SELECT id, titre, message, est_lu, date_creation
         FROM notifications WHERE id_utilisateur = ?
         ORDER BY date_creation DESC LIMIT 100`,
        [req.user.id]
      );
      return res.json(
        rows.map((r) => ({ ...r, type: "INFO", lien: null }))
      );
    }
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch("/read-all", async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE notifications SET est_lu = true WHERE id_utilisateur = ? AND est_lu = false`,
      [req.user.id]
    );
    res.json({ success: true, updated: result.affectedRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch("/:id/lu", async (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) {
    return res.status(400).json({ error: "Identifiant invalide" });
  }
  try {
    await pool.query(
      `UPDATE notifications SET est_lu = true WHERE id = ? AND id_utilisateur = ?`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/:id", async (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) {
    return res.status(400).json({ error: "Identifiant invalide" });
  }
  try {
    await pool.query(`DELETE FROM notifications WHERE id = ? AND id_utilisateur = ?`, [
      req.params.id,
      req.user.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
