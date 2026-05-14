import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import mysql from 'mysql2/promise';
import cors from 'cors';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || '8040');
  const HOST = process.env.HOST || '0.0.0.0';
  const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  app.use(express.json());
  app.use(cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    }
  }));

  let pool: mysql.Pool | null = null;

  const initDb = () => {
    if (pool) return pool;
    if (!process.env.MYSQL_HOST || !process.env.MYSQL_USER || !process.env.MYSQL_DATABASE) {
      return null;
    }
    
    try {
      pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: String(process.env.MYSQL_PASSWORD || ''),
        database: process.env.MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      console.log('MySQL pool created.');
      
      // Initialize table
      pool.query(`
        CREATE TABLE IF NOT EXISTS links (
          id VARCHAR(50) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          url TEXT NOT NULL,
          acronym VARCHAR(50),
          category VARCHAR(100)
        )
      `).then(() => {
        console.log('Links table ready.');
      }).catch(err => {
        console.error('Error creating table:', err);
      });
      return pool;
    } catch (error) {
      console.error('Error initializing MySQL pool:', error);
      return null;
    }
  };

  initDb();

  // Middleware to ensure DB connection
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      const db = initDb();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured securely. Please enter MYSQL_ variables in settings.' });
      }
    }
    next();
  });

  app.get('/health', async (_req, res) => {
    const db = initDb();
    let dbConnected = false;

    if (db) {
      try {
        await db.query('SELECT 1');
        dbConnected = true;
      } catch (error) {
        console.error('Health check database query failed:', error);
      }
    }

    res.json({
      ok: true,
      publicBaseUrl: PUBLIC_BASE_URL,
      dbConfigured: Boolean(db),
      dbConnected
    });
  });

  app.get(['/', '/index.html'], async (_req, res) => {
    const db = initDb();
    let dbConnected = false;

    if (db) {
      try {
        await db.query('SELECT 1');
        dbConnected = true;
      } catch (error) {
        console.error('Status page database query failed:', error);
      }
    }

    const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Lionship API</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f3f4f6;
        color: #111827;
        font: 16px/1.5 "Segoe UI", Arial, sans-serif;
      }
      main {
        width: min(560px, calc(100vw - 48px));
        padding: 28px 32px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        box-shadow: 0 12px 28px rgba(17, 24, 39, 0.08);
      }
      h1 { margin: 0 0 8px; font-size: 28px; }
      p { margin: 0 0 16px; }
      code {
        display: inline-block;
        padding: 2px 6px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
      }
      ul { margin: 0 0 16px; padding-left: 18px; }
      .ok { color: #166534; font-weight: 600; }
      .warn { color: #92400e; font-weight: 600; }
    </style>
  </head>
  <body>
    <main>
      <h1>Lionship API</h1>
      <p class="${dbConnected ? 'ok' : 'warn'}">
        ${dbConnected ? 'Connected to shared links database.' : 'Running, but the database is not connected.'}
      </p>
      <ul>
        <li><code>/health</code> returns API and database status</li>
        <li><code>/api/links</code> returns the live link set</li>
      </ul>
      <p>Public base URL: <code>${PUBLIC_BASE_URL}</code></p>
    </main>
  </body>
</html>`;

    res
      .status(200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(body);
  });

  // GET all links
  app.get('/api/links', async (req, res) => {
    try {
      const db = initDb()!;
      const [rows] = await db.query('SELECT * FROM links');
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // SYNC existing initial links (one-off sync helper for the frontend)
  app.post('/api/links/batch', async (req, res) => {
    try {
      const links = req.body.links;
      const db = initDb()!;
      if (!Array.isArray(links)) return res.status(400).json({ error: 'Expected an array of links' });
      for (const link of links) {
        await db.execute(
          'INSERT IGNORE INTO links (id, title, url, acronym, category) VALUES (?, ?, ?, ?, ?)',
          [link.id, link.title, link.url, link.acronym, link.category]
        );
      }
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // CREATE a new link
  app.post('/api/links', async (req, res) => {
    try {
      const { id, title, url, acronym, category } = req.body;
      const db = initDb()!;
      await db.execute(
        'INSERT INTO links (id, title, url, acronym, category) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), url=VALUES(url), acronym=VALUES(acronym), category=VALUES(category)',
        [id, title, url, acronym, category]
      );
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // UPDATE a link
  app.put('/api/links/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, url, acronym, category } = req.body;
      const db = initDb()!;
      await db.execute(
        'UPDATE links SET title = ?, url = ?, acronym = ?, category = ? WHERE id = ?',
        [title, url, acronym, category, id]
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE a link
  app.delete('/api/links/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const db = initDb()!;
      await db.execute('DELETE FROM links WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on ${PUBLIC_BASE_URL}`);
  });
}

startServer();
