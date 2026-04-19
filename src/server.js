// const app = require('./app');

// const PORT = process.env.PORT || 3000;

// app.listen(PORT, () => {
//   console.log(`🚀 ELDARA API running on port ${PORT}`);
// });


// const app = require('./app');

// const PORT = process.env.PORT || 3000;

// const { startScheduler } = require('./services/scheduler.service');

// startScheduler();

// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`🚀 ELDARA API running on port ${PORT}`);
// });

const app = require('./app');
const PORT = process.env.PORT || 3000;

const { startScheduler } = require('./services/scheduler.service');

(async () => {
  try {
    // start background jobs
    startScheduler();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 ELDARA API running on port ${PORT}`);
    });

  } catch (err) {
    console.error('Startup error:', err);
  }
})();