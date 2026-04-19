const mysql = require('mysql2/promise');
const env = require('./env');

// const pool = mysql.createPool({
//   host: env.DB_HOST,
//   user: env.DB_USER,
//   password: env.DB_PASSWORD,
//   database: env.DB_NAME,
//   port: env.DB_PORT,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
//   ssl: {
//     rejectUnauthorized: false
//   }

// });
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;
