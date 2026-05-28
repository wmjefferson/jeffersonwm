const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env'), override: true });

const express = require('express');
const cors = require('cors');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 8070;
const isProd = process.env.NODE_ENV === 'production';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8070',
  'https://jeffersonwm.com',
  'https://www.jeffersonwm.com'
];

// Middleware
app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, server-to-server, same-origin)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Be permissive for now; tighten later
    }
  },
  credentials: true
}));
app.use(session({
  secret: process.env.SESSION_SECRET || 'battalion-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    httpOnly: true
  }
}));

// Trust proxy (needed for secure cookies behind Cloudflare)
if (isProd) {
  app.set('trust proxy', 1);
}

// Mount routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/player', require('./routes/player'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/habits', require('./routes/habits'));
app.use('/api/mood', require('./routes/mood'));
app.use('/api/minigames', require('./routes/minigames'));
app.use('/api/actions', require('./routes/actions'));
app.use('/api/emotions', require('./routes/emotions'));
app.use('/api/public', require('./routes/public'));
app.use('/api/events', require('./routes/events'));

// Async initialization
async function startServer() {
  try {
    // Initialize MySQL tables
    const { initDatabase } = require('./db/schema');
    await initDatabase();

    // Seed data
    const seed = require('./db/seed');
    await seed();

    // Reset daily tasks on startup
    const gameEngine = require('./utils/gameEngine');
    await gameEngine.resetDailyTasks();

    // Start server
    app.listen(PORT, () => {
      console.log(`⚔️  Battalion server running on http://localhost:${PORT}`);
      console.log(`📊 Dashboard: http://localhost:${PORT}/api/public/dashboard`);
      console.log(`🔌 Database: MySQL (remote)`);
      if (isProd) console.log(`🌐 Production mode — CORS enabled for jeffersonwm.com`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
