const { runGardeReminders } = require("./pharmaNotificationService");
const { syncGardeFlagsFromPlanning } = require("./gardeService");

const INTERVAL_MS = 5 * 60 * 1000;
let timer = null;

function startGardeReminderScheduler() {
  if (timer) return;
  const tick = () => {
    syncGardeFlagsFromPlanning().catch((err) =>
      console.error("Sync garde:", err.message)
    );
    runGardeReminders().catch((err) => console.error("Garde reminders:", err.message));
  };
  tick();
  timer = setInterval(tick, INTERVAL_MS);
  console.log("Rappels garde pharmacien — actif (toutes les 5 min)");
}

module.exports = { startGardeReminderScheduler };
