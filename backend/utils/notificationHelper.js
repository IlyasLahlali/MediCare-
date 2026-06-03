const pool = require("../config/db");
const { ensureNotificationsSchema } = require("./ensureNotificationsSchema");

const TYPES = ["SYSTEM", "GARDE", "STOCK", "FAVORI", "INFO", "ALERT", "AVIS", "STATS"];

let notifHasTypeCol = null;

async function notificationsHasTypeColumn() {
  if (notifHasTypeCol !== null) return notifHasTypeCol;
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'
     LIMIT 1`
  );
  notifHasTypeCol = rows.length > 0;
  return notifHasTypeCol;
}

async function hasRecentNotification(userId, titre, withinHours = 24) {
  try {
    await ensureNotificationsSchema();
    const [rows] = await pool.query(
      `SELECT id FROM notifications
       WHERE id_utilisateur = ? AND titre = ?
         AND date_creation >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       LIMIT 1`,
      [userId, titre, withinHours]
    );
    return rows.length > 0;
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return false;
    throw err;
  }
}

async function createNotification({ userId, titre, message, type = "INFO", lien = null }) {
  if (!userId) {
    console.warn("createNotification: userId manquant");
    return null;
  }

  await ensureNotificationsSchema();

  const safeType = TYPES.includes(type) ? type : "INFO";
  const safeMessage = String(message || "").slice(0, 4000);
  const safeTitre = String(titre || "Notification").slice(0, 150);
  const safeLien = lien ? String(lien).slice(0, 255) : null;

  try {
    const hasType = await notificationsHasTypeColumn();
    if (hasType) {
      const [result] = await pool.query(
        `INSERT INTO notifications (id_utilisateur, titre, message, type, lien) VALUES (?, ?, ?, ?, ?)`,
        [userId, safeTitre, safeMessage, safeType, safeLien]
      );
      return result.insertId;
    }
    const [result] = await pool.query(
      `INSERT INTO notifications (id_utilisateur, titre, message) VALUES (?, ?, ?)`,
      [userId, safeTitre, safeMessage]
    );
    return result.insertId;
  } catch (err) {
    console.error("createNotification:", err.message);
    throw err;
  }
}

module.exports = { createNotification, hasRecentNotification, TYPES };
