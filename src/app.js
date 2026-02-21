// const express = require('express');

// const authRoutes = require('./routes/auth.routes');
// const errorHandler = require('./middlewares/error.middleware');
// const dailyActivityRoutes = require('./routes/dailyActivity.routes');

// const app = express();

// /**
//  * Global middlewares
//  */
// app.use(express.json());

// /**
//  * Routes
//  */
// app.use('/api/auth', authRoutes);
// app.use('/api/daily-activity', dailyActivityRoutes);
// /**
//  * Health check
//  */
// app.get('/health', (req, res) => {
//   res.status(200).json({
//     status: 'UP',
//     message: 'ELDARA API is running',
//   });
// });

// /**
//  * Error handler (MUST be last)
//  */
// app.use(errorHandler);



// module.exports = app;

const express = require('express');

const authRoutes = require('./routes/auth.routes');
const dailyActivityRoutes = require('./routes/dailyActivity.routes');
const geoRoutes = require('./routes/geo.routes');   // ✅ ADD THIS

const errorHandler = require('./middlewares/error.middleware');

const app = express();

/**
 * Global middlewares
 */
app.use(express.json());

/**
 * Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/daily-activity', dailyActivityRoutes);
app.use('/api/geo', geoRoutes);   // ✅ ADD THIS

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    message: 'ELDARA API is running',
  });
});

/**
 * Error handler (MUST be last)
 */
app.use(errorHandler);

module.exports = app;