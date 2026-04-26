
console.log("STEP 1");
const express = require('express');
console.log("STEP 2");
const authRoutes = require('./routes/auth.routes');
console.log("STEP 3");
const dailyActivityRoutes = require('./routes/dailyActivity.routes');
console.log("STEP 4");
const geoRoutes = require('./routes/geo.routes');   // ✅ ADD THIS
console.log("STEP 5");
const otpRoutes = require('./routes/otp.routes');
console.log("STEP 6");
const errorHandler = require('./middlewares/error.middleware');
console.log("STEP 7");
const signupRoutes = require('./routes/signup.routes');
console.log("STEP 8");
const patronRoutes = require('./routes/patron.routes');
console.log("STEP 9");
const fileRoutes = require('./routes/file.routes');
console.log("STEP 10");
const doctorAppointmentRoutes = require('./routes/doctorAppointment.routes');
console.log("STEP 11");
const ocrRoutes = require('./routes/ocr.routes');
console.log("STEP 12");
const masterRoutes = require('./routes/master.routes');
console.log("STEP 13");
const medicineRoutes = require('./routes/medicine.routes');
console.log("STEP 14");
const deviceRoutes = require('./routes/device.routes');
console.log("STEP 15");
const app = express();
const medicineScheduleRoutes = require('./routes/medicineSchedule.routes');
console.log("STEP 16");
const vitalsRoutes = require('./routes/vitals.routes');
console.log("STEP 17");

/**
 * Global middlewares
 */
app.use(express.json());

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
app.use('/api/doctor-appointments', doctorAppointmentRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/medicine', medicineRoutes);

app.use('/api/medicine-schedule', medicineScheduleRoutes);

app.use('/api/vitals', vitalsRoutes);

app.use('/api/device', deviceRoutes);
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