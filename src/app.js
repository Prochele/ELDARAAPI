const express = require('express');

const authRoutes = require('./routes/auth.routes');
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
