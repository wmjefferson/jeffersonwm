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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on ${PUBLIC_BASE_URL}`);
  });
}

startServer();
