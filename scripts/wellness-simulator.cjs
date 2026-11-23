// Local simulator only: production identity/assignment reads, local Wellness writes.
// No medicine scheduler, care notices, push, email or SMS workers are started here.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const express = require('express');
const { createWellnessService } = require('../src/services/wellness.service');
const { createWellnessRouter } = require('../src/routes/wellness.routes');
const { startWellnessCleanup } = require('../src/services/wellnessCleanup.service');

async function main() {
  const socketPath = process.env.WELLNESS_LOCAL_SOCKET || '/private/tmp/eldara-wellness.sock';
  // This socket belongs to the private, network-disabled simulator database.
  fs.chmodSync(socketPath, 0o600);
  const database = 'eldara_wellness_local';
  const setup = await mysql.createConnection({ socketPath, user: 'root', multipleStatements: true });
  await setup.query(`CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await setup.changeUser({ database });
  await setup.query(fs.readFileSync(path.join(__dirname, '../migrations/20261123_wellness.sql'), 'utf8'));
  await setup.query(fs.readFileSync(path.join(__dirname, '../migrations/20261123_walking.sql'), 'utf8'));
  await setup.end();
  const local = mysql.createPool({ socketPath, user: 'root', database, dateStrings: true, connectionLimit: 5 });
  const identity = require('../src/config/db');
  // This pool only services SELECTs from session validation and Wellness access checks.
  identity.on('connection', connection => connection.query('SET SESSION TRANSACTION READ ONLY'));
  const service = createWellnessService({ pool: local, accessPool: identity });
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (req, res) => res.json({ status: 'UP', mode: 'local-wellness', productionWrites: false }));
  app.use('/api/wellness', createWellnessRouter({ service, authenticate: require('../src/middlewares/session.middleware') }));
  const walking = require('../src/services/walking.service').createWalkingService({ pool: local, accessPool: identity });
  app.use('/api/walking', require('../src/routes/walking.routes').createWalkingRouter({ service: walking, authenticate: require('../src/middlewares/session.middleware') }));
  app.use((error, req, res, next) => {
    console.error('Local Wellness request failed', { code: error.code });
    res.status(500).json({ success: false, message: 'Unable to complete this request. Please try again.' });
  });
  const cleanup = startWellnessCleanup(service);
  const walkingCleanup = require('../src/services/walkingCleanup.service').startWalkingCleanup(walking);
  const server = app.listen(3001, '127.0.0.1', () => console.log('Wellness simulator API ready at http://127.0.0.1:3001 (local records; no notifications).'));
  const stop = async () => { cleanup.stop(); walkingCleanup.stop(); server.close(); await local.end(); await identity.end(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
main().catch(error => { console.error({ code: error.code, message: error.message }); process.exitCode = 1; });
