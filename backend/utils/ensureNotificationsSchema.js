const pool = require("../config/db");

const NOTIFICATION_TYPES =
  "'SYSTEM','GARDE','STOCK','FAVORI','INFO','ALERT','AVIS','STATS'";

let ensured = false;

async function ensureNotificationsSchema() {
  if (ensured) return true;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      id_utilisateur INT NOT NULL,
      titre VARCHAR(150) NOT NULL,
      message TEXT NOT NULL,
      type ENUM(${NOTIFICATION_TYPES}) NOT NULL DEFAULT 'INFO',
      lien VARCHAR(255) NULL,
      est_lu TINYINT(1) NOT NULL DEFAULT 0,
      date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE,
      INDEX idx_notif_user (id_utilisateur),
      INDEX idx_notif_unread (id_utilisateur, est_lu)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [cols] = await pool.query("SHOW COLUMNS FROM notifications LIKE 'type'");
  if (cols.length === 0) {
    await pool.query(`
      ALTER TABLE notifications
      ADD COLUMN type ENUM(${NOTIFICATION_TYPES}) NOT NULL DEFAULT 'INFO' AFTER message
    `);
  } else {
    try {
      await pool.query(`
        ALTER TABLE notifications
        MODIFY type ENUM(${NOTIFICATION_TYPES}) NOT NULL DEFAULT 'INFO'
      `);
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") {
        console.warn("notifications.type:", err.message);
      }
    }
  }

  const [lienCols] = await pool.query("SHOW COLUMNS FROM notifications LIKE 'lien'");
  if (lienCols.length === 0) {
    await pool.query(`
      ALTER TABLE notifications
      ADD COLUMN lien VARCHAR(255) NULL
    `);
  }

  ensured = true;
  return true;
}

module.exports = { ensureNotificationsSchema };
