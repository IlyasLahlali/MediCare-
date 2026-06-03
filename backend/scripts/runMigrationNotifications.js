/**
 * Table notifications + types AVIS / STATS pour le centre de notifications.
 * Usage : npm run migrate:notifications
 */
const pool = require("../config/db");

const NOTIFICATION_TYPES =
  "'SYSTEM','GARDE','STOCK','FAVORI','INFO','ALERT','AVIS','STATS'";

async function run() {
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

  try {
    await pool.query(`
      ALTER TABLE notifications
      MODIFY type ENUM(${NOTIFICATION_TYPES}) NOT NULL DEFAULT 'INFO'
    `);
  } catch (err) {
    if (err.code !== "ER_DUP_FIELDNAME") console.warn("ALTER notifications.type:", err.message);
  }

  console.log("OK — table notifications prête (types AVIS, STATS inclus).");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
