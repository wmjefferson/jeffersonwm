import cors from 'cors';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const envFile = process.env.BILLIONAIRE_ENV_FILE || (process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development');
dotenv.config({ path: path.join(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), '..', 'jeffersonwm', envFile) });
dotenv.config();

let pool: mysql.Pool | null = null;
const widgetDbHost = process.env.JEFFERSONWM_WIDGET_DB_HOST || process.env.MYSQL_HOST;
const widgetDbUser = process.env.JEFFERSONWM_WIDGET_DB_USER || process.env.MYSQL_USER;
const widgetDbPassword = process.env.JEFFERSONWM_WIDGET_DB_PASSWORD || process.env.MYSQL_PASSWORD;
const widgetDbName = process.env.JEFFERSONWM_WIDGET_DB_NAME || process.env.MYSQL_DATABASE || 'jeffers4_jeffwm_widget';
const widgetDbPort = Number(process.env.JEFFERSONWM_WIDGET_DB_PORT || process.env.MYSQL_PORT || 3306);

if (widgetDbHost && widgetDbUser && widgetDbPassword) {
  pool = mysql.createPool({
    host: widgetDbHost,
    user: widgetDbUser,
    password: widgetDbPassword,
    database: widgetDbName,
    port: widgetDbPort,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    connectTimeout: 4000,
  });
}

const fallbackActiveFonts = [
  'Archivo', 'Barrio', 'Betania Patmos In', 'Bitcount Grid Double', 'Cabin Sketch',
  'DM Sans', 'DotGothic16', 'Dr Sugiyama', 'DynaPuff', 'Jost', 'Lacquer',
  'Libertinus Keyboard', 'Libre Baskerville', 'Life Savers', 'Londrina Sketch',
  'Marcellus', 'Merriweather', 'Michroma', 'Monoton', 'Noto Color Emoji',
  'Onest', 'Oswald', 'Palette Mosaic', 'Playfair Display', 'Playwrite NZ',
  'Playwrite NZ Guides', 'Purple Purse', 'Raleway', 'Rock 3D', 'Sacramento',
  'Saira Stencil', 'Shizuru', 'Sirin Stencil', 'Slackside One', 'Smokum',
  'Smooch', 'Smooch Sans', 'Stardos Stencil', 'Stick No Bills',
  'UnifrakturMaguntia', 'Wavefont'
];

type AuthUser = {
  id: string;
  username: string;
  displayName?: string | null;
  isAdmin?: boolean;
  isOwner?: boolean;
  isApproved?: boolean;
};

type AuthStatus = {
  ok?: boolean;
  user?: AuthUser | null;
};

type SubmissionStatus = 'pending' | 'saved' | 'archived' | 'processed';

const PORT = Number(process.env.PORT || '8140');
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || './data');
const DB_PATH = path.join(DATA_DIR, 'billionaire.sqlite');
const AUTH_BASE_URL = (process.env.AUTH_BASE_URL || 'https://auth.jeffersonwm.com').replace(/\/$/, '');
const AUTH_INTERNAL_LOG_TOKEN = (process.env.BILLIONAIRE_AUTH_INTERNAL_LOG_TOKEN || process.env.AUTH_INTERNAL_LOG_TOKEN || '0fd4b372cabf46e4afdae1be1a1d4fa5a49b076fa53c62b8619f2faeab1b12ee').trim();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const app = express();
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS phone_submissions (
    id TEXT PRIMARY KEY,
    phone_digits TEXT NOT NULL,
    phone_formatted TEXT NOT NULL,
    phone_masked TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    associated_user_id TEXT,
    associated_username TEXT,
    account_association_requested INTEGER NOT NULL DEFAULT 0,
    approximate_location TEXT,
    device_summary TEXT,
    timezone TEXT,
    language TEXT,
    referrer TEXT,
    user_agent TEXT
  );
`);

const isoNow = () => new Date().toISOString();
const makeId = () => crypto.randomUUID();
const cleanText = (value: unknown, maxLength = 500) => String(value || '').trim().slice(0, maxLength);
const normalizePhoneInput = (value: unknown) => {
  const trimmed = String(value || '').trim();
  const sanitized = trimmed.replace(/[^0-9+,\*#wW;\s()\-.]/g, '').slice(0, 50);
  const rawDialString = sanitized.replace(/[\s().\-]/g, '');
  const digitsOnly = rawDialString.replace(/\D/g, '');
  return {
    raw: rawDialString,
    digits: digitsOnly,
    hasPlus: rawDialString.startsWith('+'),
  };
};

const formatPhone = ({ raw, digits, hasPlus }: ReturnType<typeof normalizePhoneInput>) => {
  if (/[,*#wW;]/.test(raw)) {
    return raw;
  }
  if (hasPlus && digits.startsWith('1') && digits.length <= 11) {
    const local = digits.slice(1);
    if (!local) return '+1';
    if (local.length < 4) return `+1 ${local}`;
    if (local.length < 7) return `+1 (${local.slice(0, 3)}) ${local.slice(3)}`;
    return `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  if (hasPlus || digits.length > 10) {
    return `${hasPlus ? '+' : ''}${digits.match(/.{1,3}/g)?.join(' ') || digits}`;
  }
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const isValidPhone = ({ digits, raw }: ReturnType<typeof normalizePhoneInput>) => {
  if (!raw || digits.length < 7 || digits.length > 30) return false;
  return /^[+0-9,\*#wW;]+$/.test(raw);
};

const maskPhone = ({ digits, raw, hasPlus }: ReturnType<typeof normalizePhoneInput>) => {
  if (/[,*#wW;]/.test(raw)) {
    if (digits.length >= 4) {
      let remainingCount = 0;
      return raw.split('').map((char) => {
        if (/\d/.test(char)) {
          remainingCount++;
          return remainingCount <= digits.length - 4 ? '*' : char;
        }
        return char;
      }).join('');
    }
    return '***';
  }
  return hasPlus || digits.length > 10
    ? `${hasPlus ? '+' : ''}*** *** ${digits.slice(-4)}`
    : `***-***-${digits.slice(-4)}`;
};

const headerValue = (req: express.Request, name: string) => {
  const value = req.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

const approximateLocationFromRequest = (req: express.Request) => {
  const parts = [
    headerValue(req, 'cf-ipcity'),
    headerValue(req, 'cf-region'),
    headerValue(req, 'cf-ipcountry'),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Unknown';
};

const deviceSummaryFromUserAgent = (userAgent: string) => {
  const source = userAgent.toLowerCase();
  const form = /mobile|iphone|android/.test(source) ? 'Mobile' : /ipad|tablet/.test(source) ? 'Tablet' : 'Desktop';
  const browser = source.includes('edg/')
    ? 'Edge'
    : source.includes('opr/') || source.includes('opera')
      ? 'Opera'
      : source.includes('firefox/')
        ? 'Firefox'
        : source.includes('safari/') && !source.includes('chrome/')
          ? 'Safari'
          : source.includes('chrome/')
            ? 'Chrome'
            : 'Browser';
  const os = source.includes('windows')
    ? 'Windows'
    : source.includes('mac os')
      ? 'macOS'
      : source.includes('android')
        ? 'Android'
        : source.includes('iphone') || source.includes('ipad')
          ? 'iOS'
          : source.includes('linux')
            ? 'Linux'
            : 'Unknown OS';
  return `${form} / ${browser} / ${os}`;
};

const postAuthHistory = async (action: string, target: Record<string, unknown>, user?: AuthUser | null) => {
  if (!AUTH_INTERNAL_LOG_TOKEN) return;
  try {
    await fetch(`${AUTH_BASE_URL}/api/history/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-internal-token': AUTH_INTERNAL_LOG_TOKEN,
      },
      body: JSON.stringify({
        action,
        site: 'billionaire',
        target: JSON.stringify(target),
        userId: user?.id || null,
        username: user?.username || null,
        internalToken: AUTH_INTERNAL_LOG_TOKEN,
      }),
    });
  } catch (error) {
    console.warn('Failed to notify Auth history stream:', error);
  }
};

const getAuthStatus = async (req: express.Request): Promise<AuthStatus> => {
  try {
    const response = await fetch(`${AUTH_BASE_URL}/api/auth/status`, {
      headers: {
        cookie: req.headers.cookie || '',
      },
    });
    if (!response.ok) return { ok: false, user: null };
    return await response.json() as AuthStatus;
  } catch {
    return { ok: false, user: null };
  }
};

const requireOwner = async (req: express.Request, res: express.Response) => {
  const status = await getAuthStatus(req);
  const user = status.user;
  if (!user?.isOwner) {
    res.status(403).json({ ok: false, error: 'You do not have permission.' });
    return null;
  }
  return user;
};

const rowToSubmission = (row: Record<string, unknown>) => ({
  id: String(row.id),
  phone: String(row.phone_formatted || ''),
  maskedPhone: String(row.phone_masked || ''),
  status: String(row.status || 'pending'),
  createdAt: String(row.created_at || ''),
  updatedAt: String(row.updated_at || ''),
  associatedUsername: row.associated_username ? String(row.associated_username) : null,
  accountAssociationRequested: Boolean(row.account_association_requested),
  approximateLocation: row.approximate_location ? String(row.approximate_location) : null,
  deviceSummary: row.device_summary ? String(row.device_summary) : null,
  timezone: row.timezone ? String(row.timezone) : null,
  language: row.language ? String(row.language) : null,
  referrer: row.referrer ? String(row.referrer) : null,
  userAgent: row.user_agent ? String(row.user_agent) : null,
});

app.use(express.json({ limit: '32kb' }));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by CORS'));
  },
}));

app.get('/health', (_req, res) => {
  res.json({ ok: true, app: 'billionaire', publicBaseUrl: PUBLIC_BASE_URL, storage: 'sqlite', dbPath: DB_PATH });
});

app.get('/api/auth/status', async (req, res) => {
  const auth = await getAuthStatus(req);
  res.json({ ok: true, user: auth.user || null });
});

app.get('/api/fonts', async (_req, res) => {
  if (pool) {
    try {
      const [rows] = await pool.query(
        'SELECT name FROM widget_fonts WHERE round IN (1, 2) AND weight > 0 ORDER BY name ASC'
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const fonts = (rows as Array<{ name: string }>).map((r) => r.name);
        res.json({ ok: true, fonts });
        return;
      }
    } catch (error) {
      console.warn('Failed to query widget_fonts from MySQL, using fallback fonts:', error);
    }
  }
  res.json({ ok: true, fonts: fallbackActiveFonts });
});

app.post('/api/submissions', async (req, res) => {
  const normalizedPhone = normalizePhoneInput(req.body?.phone);
  if (!isValidPhone(normalizedPhone)) {
    res.status(400).json({ ok: false, error: 'Enter a valid phone number with an area or country code.' });
    return;
  }

  const now = isoNow();
  const id = makeId();
  const formatted = formatPhone(normalizedPhone);
  const masked = maskPhone(normalizedPhone);
  const userAgent = cleanText(req.get('user-agent'), 1000);
  const approximateLocation = approximateLocationFromRequest(req);
  const deviceSummary = deviceSummaryFromUserAgent(userAgent);
  const timezone = cleanText(req.body?.timezone, 80);
  const language = cleanText(req.body?.language, 80);
  const referrer = cleanText(req.body?.referrer || req.get('referer'), 400);

  db.prepare(`
    INSERT INTO phone_submissions (
      id, phone_digits, phone_formatted, phone_masked, status, created_at, updated_at,
      approximate_location, device_summary, timezone, language, referrer, user_agent
    )
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, normalizedPhone.raw, formatted, masked, now, now, approximateLocation, deviceSummary, timezone, language, referrer, userAgent);

  await postAuthHistory('billionaire.phone_submitted', {
    phone: formatted,
    formattedPhone: formatted,
    maskedPhone: masked,
    location: approximateLocation,
    device: deviceSummary,
  });

  res.status(201).json({ ok: true, id, maskedPhone: masked });
});

app.post('/api/submissions/:id/associate', async (req, res) => {
  const auth = await getAuthStatus(req);
  if (!auth.user) {
    res.status(401).json({ ok: false, error: 'Sign in or register to associate this number.' });
    return;
  }

  const id = cleanText(req.params.id, 80);
  const existing = db.prepare('SELECT id, phone_formatted, phone_digits, phone_masked FROM phone_submissions WHERE id = ?').get(id) as {
    id: string;
    phone_formatted?: string;
    phone_digits?: string;
    phone_masked?: string;
  } | undefined;
  if (!existing) {
    res.status(404).json({ ok: false, error: 'Submission not found.' });
    return;
  }

  db.prepare(`
    UPDATE phone_submissions
    SET account_association_requested = 1,
      associated_user_id = ?,
      associated_username = ?,
      updated_at = ?
    WHERE id = ?
  `).run(auth.user.id, auth.user.username, isoNow(), id);

  await postAuthHistory('billionaire.phone_associated', {
    phone: existing.phone_formatted || existing.phone_digits || existing.phone_masked || id,
    username: auth.user.username,
  }, auth.user);

  res.json({ ok: true, username: auth.user.username });
});

app.get('/api/admin/submissions', async (req, res) => {
  const user = await requireOwner(req, res);
  if (!user) return;

  const rows = db.prepare(`
    SELECT *
    FROM phone_submissions
    ORDER BY created_at DESC
    LIMIT 500
  `).all() as Record<string, unknown>[];
  res.json({ ok: true, user, submissions: rows.map(rowToSubmission) });
});

app.put('/api/admin/submissions/:id/status', async (req, res) => {
  const user = await requireOwner(req, res);
  if (!user) return;

  const id = cleanText(req.params.id, 80);
  const status = cleanText(req.body?.status, 40) as SubmissionStatus;
  if (!['pending', 'saved', 'archived', 'processed'].includes(status)) {
    res.status(400).json({ ok: false, error: 'Unsupported status.' });
    return;
  }

  const row = db.prepare('SELECT phone_formatted, phone_masked FROM phone_submissions WHERE id = ?').get(id) as { phone_formatted?: string; phone_masked?: string } | undefined;
  if (!row) {
    res.status(404).json({ ok: false, error: 'Submission not found.' });
    return;
  }

  db.prepare('UPDATE phone_submissions SET status = ?, updated_at = ? WHERE id = ?').run(status, isoNow(), id);

  const action = status === 'saved'
    ? 'billionaire.phone_saved'
    : status === 'archived'
      ? 'billionaire.phone_archived'
      : status === 'processed'
        ? 'billionaire.phone_processed'
        : null;
  if (action) {
    await postAuthHistory(action, { phone: row.phone_formatted || row.phone_masked || '***-***-****', status }, user);
  }

  res.json({ ok: true });
});

app.delete('/api/admin/submissions/:id', async (req, res) => {
  const user = await requireOwner(req, res);
  if (!user) return;

  const id = cleanText(req.params.id, 80);
  const row = db.prepare('SELECT phone_formatted, phone_masked FROM phone_submissions WHERE id = ?').get(id) as { phone_formatted?: string; phone_masked?: string } | undefined;
  if (!row) {
    res.status(404).json({ ok: false, error: 'Submission not found.' });
    return;
  }

  db.prepare('DELETE FROM phone_submissions WHERE id = ?').run(id);
  await postAuthHistory('billionaire.phone_deleted', { phone: row.phone_formatted || row.phone_masked || '***-***-****' }, user);
  res.json({ ok: true });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(process.cwd(), 'dist')));
  app.use((_req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`Billionaire running on ${PUBLIC_BASE_URL}`);
});
