

const express = require('express');

const authRoutes = require('./routes/auth.routes');
const dailyActivityRoutes = require('./routes/dailyActivity.routes');
const geoRoutes = require('./routes/geo.routes');   // ✅ ADD THIS
const otpRoutes = require('./routes/otp.routes');
const errorHandler = require('./middlewares/error.middleware');
const signupRoutes = require('./routes/signup.routes');
const patronRoutes = require('./routes/patron.routes');
const fileRoutes = require('./routes/file.routes');

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
app.use('/api/otp', otpRoutes);
app.use('/api/signup', signupRoutes);
app.use('/api/patron', patronRoutes);
app.use('/api/file', fileRoutes);
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