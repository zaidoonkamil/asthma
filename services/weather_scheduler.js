const { sendWeatherNotifications } = require("./weather_notifications");

const twelveHours = 12 * 60 * 60 * 1000;
let isRunning = false;

const runWeatherNotificationJob = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const result = await sendWeatherNotifications();
    console.log(`Weather notifications sent for ${result.users} users`);
  } catch (err) {
    console.error("Weather notification job error:", err.message);
  } finally {
    isRunning = false;
  }
};

const startWeatherNotificationScheduler = () => {
  setTimeout(runWeatherNotificationJob, 60 * 1000);
  setInterval(runWeatherNotificationJob, twelveHours);
  console.log("Weather notification scheduler started: every 12 hours");
};

module.exports = {
  startWeatherNotificationScheduler,
  runWeatherNotificationJob,
};
