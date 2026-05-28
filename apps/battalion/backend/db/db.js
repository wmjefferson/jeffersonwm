// ─── MySQL Connection Pools ─────────────────────────────────────────
const path = require('path');
const envPath = path.resolve(__dirname, '..', '.env');
require('dotenv').config({ path: envPath, override: true });
const mysql = require('mysql2/promise');

const poolConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

// Game data pool (actions, tasks, habits, player, etc.)
const db = mysql.createPool({ ...poolConfig, database: process.env.MYSQL_DATABASE });

// Emotions pool (emotion categories, individual emotions)
const emoDb = mysql.createPool({ ...poolConfig, database: process.env.MYSQL_EMO_DATABASE });

module.exports = { db, emoDb };
