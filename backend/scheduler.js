// backend/scheduler.js
// Schedules periodic tasks for the backend

const { fetchAndStoreOkxTokens } = require('./okxTokensFetcher');

// function startTokenFetchScheduler() {
//   // Fetch immediately on startup
//   fetchAndStoreOkxTokens();
//   // Fetch every 2 hours
//   setInterval(fetchAndStoreOkxTokens, 2 * 60 * 60 * 1000);
// }

// module.exports = { startTokenFetchScheduler };
