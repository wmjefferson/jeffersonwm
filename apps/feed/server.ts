import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import cors from "cors";
import dotenv from "dotenv";
import Parser from "rss-parser";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || "8050");
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const parser = new Parser();
const CHANGELOG_SOURCE_URLS = (process.env.CHANGELOG_SOURCE_URLS || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const CHANGELOG_POLL_MINUTES = Number(process.env.CHANGELOG_POLL_MINUTES || "15");

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(express.json());

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "feed_db",
  timezone: "Z",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

interface FeedDbRow {
  total?: number;
}

interface ChangelogEntryInput {
  id?: string;
  externalId?: string;
  appName?: string;
  version?: string;
  title?: string;
  highlights?: string[];
  changes?: string[];
  bullets?: string[];
  url?: string | null;
  createdAt?: string;
  source?: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeVersion(value: string) {
  return value.trim().replace(/^v\.?/i, "");
}

function buildReleaseTitle(appName: string, version: string) {
  const normalizedVersion = normalizeVersion(version);
  return normalizedVersion ? `${appName.trim()} v${normalizedVersion}` : appName.trim();
}

function buildReleaseHtml(highlights: string[]) {
  const cleanHighlights = highlights.map((item) => item.trim()).filter(Boolean);
  if (cleanHighlights.length === 0) {
    return null;
  }

  return `<div class="release-note-body"><p>What's new</p><ul>${cleanHighlights
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul></div>`;
}

function normalizeChangelogEntries(payload: unknown): ChangelogEntryInput[] {
  if (Array.isArray(payload)) {
    return payload as ChangelogEntryInput[];
  }

  if (payload && typeof payload === "object") {
    const objectPayload = payload as Record<string, unknown>;
    if (Array.isArray(objectPayload.entries)) {
      return objectPayload.entries as ChangelogEntryInput[];
    }

    if ("appName" in objectPayload || "version" in objectPayload || "title" in objectPayload) {
      return [objectPayload as ChangelogEntryInput];
    }
  }

  return [];
}

async function upsertReleaseEntry(entry: ChangelogEntryInput, fallbackSource: string) {
  const appName = entry.appName?.trim();
  const version = entry.version?.trim();
  const title = entry.title?.trim() || (appName && version ? buildReleaseTitle(appName, version) : null);
  const highlights = (entry.highlights || entry.changes || entry.bullets || [])
    .map((item) => String(item).trim())
    .filter(Boolean);
  const content = buildReleaseHtml(highlights);
  const source = (entry.source || fallbackSource || "release").trim() || "release";
  const externalId =
    entry.externalId?.trim() ||
    entry.id?.trim() ||
    (appName && version ? `${appName.toLowerCase().replace(/\s+/g, "-")}-release-v${normalizeVersion(version)}` : null);

  if (!title || !externalId) {
    return false;
  }

  const sql = `
    INSERT INTO feed_items (title, content, url, source, external_id, created_at)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      content = VALUES(content),
      url = VALUES(url),
      source = VALUES(source),
      created_at = COALESCE(VALUES(created_at), created_at)
  `;

  await pool.execute(sql, [
    title,
    content,
    entry.url || null,
    source,
    externalId,
    entry.createdAt || null,
  ]);

  return true;
}

async function fetchChangelogSources(throwOnError: boolean = false) {
  if (CHANGELOG_SOURCE_URLS.length === 0) {
    return { imported: 0, sources: 0 };
  }

  let imported = 0;

  for (const sourceUrl of CHANGELOG_SOURCE_URLS) {
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      const entries = normalizeChangelogEntries(payload);
      const sourceName =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? String((payload as Record<string, unknown>).source || "release")
          : "release";

      for (const entry of entries) {
        const inserted = await upsertReleaseEntry(entry, sourceName);
        if (inserted) {
          imported += 1;
        }
      }
    } catch (error) {
      console.error(`Failed to import changelog source ${sourceUrl}:`, error);
      if (throwOnError) {
        throw error;
      }
    }
  }

  return { imported, sources: CHANGELOG_SOURCE_URLS.length };
}

app.get("/health", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT COUNT(*) AS total FROM feed_items");
    const total = Array.isArray(rows) ? Number((rows[0] as FeedDbRow)?.total || 0) : 0;
    res.json({
      ok: true,
      app: "feed",
      publicBaseUrl: PUBLIC_BASE_URL,
      totalItems: total,
      changelogSources: CHANGELOG_SOURCE_URLS.length,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      app: "feed",
      error: error?.message || "Health check failed",
    });
  }
});

// Initialize table (MySQL syntax)
async function initDb() {
  try {
    await pool.query(`SET time_zone = '+00:00'`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feed_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        url TEXT,
        source VARCHAR(50),
        external_id VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("MySQL Database initialized");
    // Initial fetch
    fetchFeeds();
    fetchChangelogSources();
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}

// Function to fetch and save feeds
async function fetchFeeds(throwOnError: boolean = false) {
  const githubUrl = process.env.GITHUB_FEED_URL;
  if (!githubUrl) {
    console.log("No GITHUB_FEED_URL set in environment variables. Skipping fetch.");
    return;
  }

  if (githubUrl.includes("yourusername.atom")) {
    console.log("GITHUB_FEED_URL is configured as a placeholder. Skipping fetch.");
    return;
  }

  console.log(`Fetching automated feeds from URL: ${githubUrl}`);
  
  let xmlText = "";
  let attempt = 0;
  const maxAttempts = 3;
  let lastError: any = null;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds connection timeout

      const response = await fetch(githubUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/atom+xml, application/xml, text/xml, */*",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      xmlText = await response.text();
      break; // Successfully fetched, break the retry loop
    } catch (err: any) {
      lastError = err;
      const isTimeout = err.name === "AbortError";
      console.warn(
        `Attempt ${attempt}/${maxAttempts} failed to retrieve GitHub feed: ${
          isTimeout ? "Connection Timeout (12s)" : err.message || err
        }`
      );
      if (attempt < maxAttempts) {
        // Linear backoff delay: 1500ms * attempt
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  if (!xmlText) {
    const errorMsg = lastError?.message || "Unknown fetching error";
    console.error(`Error fetching GitHub feed: Failed after ${maxAttempts} attempts. Last error: ${errorMsg}`);
    if (throwOnError) {
      throw new Error(`Failed to retrieve GitHub feed after multiple retries. Last error: ${errorMsg}`);
    }
    return;
  }

  try {
    const feed = await parser.parseString(xmlText);
    
    for (const item of feed.items) {
      const sql = `
        INSERT INTO feed_items (title, content, url, source, external_id, created_at)
        VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          content = VALUES(content),
          url = VALUES(url),
          source = VALUES(source),
          created_at = COALESCE(VALUES(created_at), created_at)
      `;
      // Atom feeds use item.id or item.guid as the external_id.
      // Upserting lets edited GitHub items refresh in place on later polls.
      await pool.execute(sql, [
        item.title || "Untitled GitHub Event",
        item.content || item.contentSnippet || null,
        item.link || null,
        "github",
        item.id || item.guid || item.link,
        item.isoDate || item.pubDate || null,
      ]);
    }
    console.log(`Updated GitHub feed: ${feed.items.length} items processed.`);
  } catch (err: any) {
    console.error("Error parsing/inserting GitHub feed:", err.message || err);
    if (throwOnError) {
      throw err;
    }
  }
}

// Poll feeds every 15 minutes
setInterval(() => {
  fetchFeeds(false).catch((err) => console.error("Background fetchFeeds failed:", err));
}, 15 * 60 * 1000);

setInterval(() => {
  fetchChangelogSources(false).catch((err) => console.error("Background changelog import failed:", err));
}, CHANGELOG_POLL_MINUTES * 60 * 1000);

initDb();

// API Routes
app.get("/api/changelog/schema", (_req, res) => {
  res.json({
    source: "release",
    entries: [
      {
        id: "perihelion-v0.4.0",
        appName: "Perihelion",
        version: "0.4.0",
        url: "https://jeffersonwm.com/perihelion/",
        createdAt: "2026-05-25T10:30:00.000Z",
        highlights: [
          "Connected Perihelion to central auth",
          "Added folder thumbnail previews",
          "Locked the archive behind app membership",
        ],
      },
    ],
  });
});

app.get("/api/feed", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM feed_items ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

app.post("/api/feed/refresh", async (req, res) => {
  try {
    await fetchFeeds(true);
    res.json({ success: true, message: "Feed refreshed successfully" });
  } catch (err: any) {
    console.error("Manual refresh failed:", err);
    res.status(502).json({ 
      error: "GitHub feed currently timeout or unreachable", 
      details: err.message || String(err) 
    });
  }
});

app.post("/api/feed/import-changelogs", async (req, res) => {
  const { secret } = req.body || {};
  if (!secret || secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await fetchChangelogSources(true);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(502).json({
      error: "Failed to import changelog sources",
      details: error?.message || String(error),
    });
  }
});

app.post("/api/auth/verify", (req, res) => {
  const { secret } = req.body;
  if (!secret || secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Invalid secret key" });
  }
  res.json({ success: true });
});

app.post("/api/feed", async (req, res) => {
  const { secret, title, content, url, source, external_id } = req.body;

  if (secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  try {
    const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    const sql = `
      INSERT INTO feed_items (title, content, url, source, external_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title=VALUES(title),
        content=VALUES(content),
        url=VALUES(url),
        source=VALUES(source)
    `;
    
    await pool.execute(sql, [
      title, 
      content || null, 
      url || null, 
      source || "manual", 
      external_id || null,
      createdAt
    ]);
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add feed item" });
  }
});

app.put("/api/feed/:id", async (req, res) => {
  const { id } = req.params;
  const { secret, title, content, url, source } = req.body || {};

  if (secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  try {
    const [rows] = await pool.query("SELECT id, source FROM feed_items WHERE id = ? LIMIT 1", [id]);
    const entry = Array.isArray(rows) ? rows[0] as { id: number; source: string } | undefined : undefined;

    if (!entry) {
      return res.status(404).json({ error: "Feed item not found" });
    }

    if ((entry.source || "").toLowerCase() === "github") {
      return res.status(403).json({ error: "GitHub feed items cannot be edited here" });
    }

    await pool.execute(
      `
        UPDATE feed_items
        SET title = ?, content = ?, url = ?, source = ?
        WHERE id = ?
      `,
      [title, content || null, url || null, source || entry.source || "manual", id],
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update feed item" });
  }
});

app.delete("/api/feed/:id", async (req, res) => {
  const { id } = req.params;
  const { secret } = req.body || {};

  if (secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [rows] = await pool.query("SELECT id, source FROM feed_items WHERE id = ? LIMIT 1", [id]);
    const entry = Array.isArray(rows) ? rows[0] as { id: number; source: string } | undefined : undefined;

    if (!entry) {
      return res.status(404).json({ error: "Feed item not found" });
    }

    if ((entry.source || "").toLowerCase() === "github") {
      return res.status(403).json({ error: "GitHub feed items cannot be deleted here" });
    }

    await pool.execute("DELETE FROM feed_items WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete feed item" });
  }
});

app.post("/api/feed/changelog", async (req, res) => {
  const { secret, source, entries: bodyEntries, ...singleEntry } = req.body || {};

  if (!secret || secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const entries = normalizeChangelogEntries(bodyEntries ? { entries: bodyEntries } : singleEntry);
  if (entries.length === 0) {
    return res.status(400).json({ error: "No changelog entries supplied" });
  }

  let imported = 0;
  for (const entry of entries) {
    const inserted = await upsertReleaseEntry(entry, source || "release");
    if (inserted) {
      imported += 1;
    }
  }

  res.json({ success: true, imported });
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Feed running on ${PUBLIC_BASE_URL}`);
  });
}

startServer();
