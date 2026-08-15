import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mysql from 'mysql2/promise';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFile = process.env.JEFFERSONWM_ENV_FILE || (process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development');

dotenv.config({ path: path.join(__dirname, envFile) });
dotenv.config();

const app = express();
const port = Number(process.env.JEFFERSONWM_PORT || process.env.PORT || 3000);
const allowedOrigins = (process.env.JEFFERSONWM_ALLOWED_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const adminToken = process.env.JEFFERSONWM_WIDGET_ADMIN_TOKEN || '';
const geoapifyApiKey = process.env.GEOAPIFY_API_KEY || '';
const authBaseUrl = (process.env.JEFFERSONWM_AUTH_BASE_URL || 'https://auth.jeffersonwm.com').replace(/\/$/, '');

type WidgetFont = {
  id?: number;
  name: string;
  weight?: number;
  probability?: number;
};

type WidgetEvent = {
  id?: number;
  name: string;
  description?: string | null;
  date: string;
  end_date?: string | null;
  is_public?: number | boolean;
};

type UserWidgetPreference = {
  auth_user_id: string;
  location_label?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  weather_unit?: string | null;
};

type LocationSuggestion = {
  label: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  weatherUnit: 'fahrenheit' | 'celsius';
};

type WidgetWords = {
  dictionary: string;
  merriam: string;
  oxford: string;
  wiktionary: string;
};

type AuthStatusUser = {
  id?: string;
  username?: string;
  displayName?: string | null;
  isAdmin?: boolean;
  isApproved?: boolean;
  isBlocked?: boolean;
  isDeleted?: boolean;
};

const fallbackFonts: WidgetFont[] = [
  { name: 'IBM Plex Sans Condensed', weight: 2, probability: 3 },
  { name: 'Newsreader', weight: 2, probability: 2 },
  { name: 'Gelasio', weight: 2, probability: 1 },
];

const fallbackWords: WidgetWords = {
  dictionary: 'Dictionary.com',
  merriam: 'Merriam-Webster',
  oxford: 'Oxford',
  wiktionary: 'Wiktionary',
};

const defaultWidgetPreference = {
  location_label: 'San Francisco',
  latitude: 37.7749,
  longitude: -122.4194,
  weather_unit: 'fahrenheit',
};

let wotdCache: { data: WidgetWords; timestamp: number } | null = null;

const dbConfig = {
  host: process.env.JEFFERSONWM_WIDGET_DB_HOST || process.env.MYSQL_HOST,
  user: process.env.JEFFERSONWM_WIDGET_DB_USER || process.env.MYSQL_USER,
  password: process.env.JEFFERSONWM_WIDGET_DB_PASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.JEFFERSONWM_WIDGET_DB_NAME || process.env.MYSQL_DATABASE,
  port: Number(process.env.JEFFERSONWM_WIDGET_DB_PORT || process.env.MYSQL_PORT || 3306),
};

const isDbConfigured = Boolean(dbConfig.host && dbConfig.user && dbConfig.password && dbConfig.database);

const pool = isDbConfigured
  ? mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })
  : null;

async function getAuthUser(req: express.Request): Promise<AuthStatusUser | null> {
  const cookieHeader = req.get('cookie') || '';
  if (!cookieHeader) {
    return null;
  }

  try {
    const response = await fetch(`${authBaseUrl}/api/auth/status`, {
      headers: {
        cookie: cookieHeader,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as { user?: AuthStatusUser | null };
    const user = payload.user;
    if (!user || !user.isApproved || user.isBlocked || user.isDeleted) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('JeffersonWM auth status check failed:', error);
    return null;
  }
}

async function hasAdminAccess(req: express.Request, user?: AuthStatusUser | null) {
  if (adminToken && req.get('x-widget-admin-token') === adminToken) {
    return true;
  }

  const resolvedUser = user === undefined ? await getAuthUser(req) : user;
  return Boolean(resolvedUser?.isAdmin);
}

async function requireWidgetAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (await hasAdminAccess(req)) {
    next();
    return;
  }

  res.status(403).json({
    ok: false,
    error: 'Widget admin access is not enabled for this request.',
  });
}

function requireDb(res: express.Response) {
  if (!pool) {
    res.status(503).json({
      ok: false,
      error: 'JeffersonWM widget database is not configured yet.',
    });
    return null;
  }

  return pool;
}

function getCurrentUserId() {
  return process.env.JEFFERSONWM_DEV_USERNAME || 'jefferson';
}

function getWidgetUserId(user: AuthStatusUser | null) {
  return user?.username || user?.id || getCurrentUserId();
}

function normalizeDateValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value || '').slice(0, 10);
}

function normalizeOptionalDateValue(value: unknown) {
  const normalized = normalizeDateValue(value);
  return normalized || null;
}

function getFirstString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }

  return '';
}

function normalizeGeoapifyResult(result: Record<string, unknown>): LocationSuggestion | null {
  const city = getFirstString(result.city, result.town, result.village, result.municipality, result.county, result.name);
  const region = getFirstString(result.state, result.region, result.county);
  const country = getFirstString(result.country);
  const countryCode = getFirstString(result.country_code).toLowerCase();
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);

  if (!city || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const labelParts = [city, region, country].filter(Boolean);

  return {
    label: labelParts.join(', '),
    city,
    region,
    country,
    countryCode,
    latitude,
    longitude,
    weatherUnit: getDefaultWeatherUnit(countryCode),
  };
}

function getDefaultWeatherUnit(countryCode: string): 'fahrenheit' | 'celsius' {
  const fahrenheitCountries = new Set([
    'bs',
    'bz',
    'ky',
    'lr',
    'pw',
    'us',
  ]);

  return fahrenheitCountries.has(countryCode.toLowerCase()) ? 'fahrenheit' : 'celsius';
}

function scoreLocationSuggestion(suggestion: LocationSuggestion, query: string) {
  const normalizedQuery = query.toLowerCase();
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const city = suggestion.city.toLowerCase();
  const label = suggestion.label.toLowerCase();
  let score = 0;

  if (city === normalizedQuery) {
    score += 1000;
  }

  if (city.startsWith(normalizedQuery)) {
    score += 500;
  }

  if (label.includes(normalizedQuery)) {
    score += 250;
  }

  for (const token of tokens) {
    if (city.startsWith(token)) {
      score += 75;
    } else if (city.includes(token)) {
      score += 35;
    }

    if (label.includes(token)) {
      score += 20;
    }
  }

  return score;
}

function sortEventsByNextOccurrence(events: WidgetEvent[]) {
  const today = new Date();
  const current = (today.getMonth() + 1) * 100 + today.getDate();

  return [...events].sort((a, b) => {
    const aDate = new Date(a.date);
    const bDate = new Date(b.date);
    const aValue = (aDate.getUTCMonth() + 1) * 100 + aDate.getUTCDate();
    const bValue = (bDate.getUTCMonth() + 1) * 100 + bDate.getUTCDate();
    const aDistance = aValue >= current ? aValue - current : aValue + 1231 - current;
    const bDistance = bValue >= current ? bValue - current : bValue + 1231 - current;
    return aDistance - bDistance;
  });
}

async function getEvents() {
  if (!pool) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT id, name, description, date, end_date, is_public
     FROM widget_special_dates
     ORDER BY MONTH(date) ASC, DAY(date) ASC, name ASC`,
  );

  return (rows as WidgetEvent[]).map(event => ({
    ...event,
    date: normalizeDateValue(event.date),
    end_date: event.end_date ? normalizeDateValue(event.end_date) : null,
  }));
}

async function getUserEvents(authUserId: string) {
  if (!pool) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT id, auth_user_id, name, description, date, end_date
     FROM user_widget_special_dates
     WHERE auth_user_id = ?
     ORDER BY MONTH(date) ASC, DAY(date) ASC, name ASC`,
    [authUserId],
  );

  return (rows as WidgetEvent[]).map(event => ({
    ...event,
    date: normalizeDateValue(event.date),
    end_date: event.end_date ? normalizeDateValue(event.end_date) : null,
  }));
}

async function getUserPreference(authUserId: string) {
  if (!pool) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT auth_user_id, location_label, latitude, longitude, weather_unit
     FROM user_widget_preferences
     WHERE auth_user_id = ?
     LIMIT 1`,
    [authUserId],
  );

  return (rows as UserWidgetPreference[])[0] || null;
}

async function getFonts() {
  if (!pool) {
    return fallbackFonts;
  }

  const [rows] = await pool.query(
    `SELECT id, name, weight, probability
     FROM widget_fonts
     ORDER BY name ASC`,
  );

  return rows as WidgetFont[];
}

async function getWidgetWords() {
  if (wotdCache && Date.now() - wotdCache.timestamp < 60 * 60 * 1000) {
    return wotdCache.data;
  }

  const fetchOptions = {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  };

  const result: WidgetWords = { ...fallbackWords };

  try {
    const dictionaryResponse = await fetch('https://www.dictionary.com/e/word-of-the-day/', fetchOptions);
    const dictionaryHtml = await dictionaryResponse.text();
    const dictionaryMatch =
      dictionaryHtml.match(/<div class="otd-item-headword__word">[\s\S]*?<h1>(.*?)<\/h1>/i) ||
      dictionaryHtml.match(/<title>Word of the Day: (.*?) \| Dictionary\.com<\/title>/i);

    if (dictionaryMatch?.[1]) {
      result.dictionary = dictionaryMatch[1].replace(/<[^>]*>/g, '').trim();
    }
  } catch (error) {
    console.error('Dictionary WOTD fetch failed:', error);
  }

  try {
    const merriamResponse = await fetch('https://www.merriam-webster.com/wotd/feed/rss2', fetchOptions);
    const merriamXml = await merriamResponse.text();
    const merriamMatch = merriamXml.match(/<item>[\s\S]*?<title>(?:Word of the Day: )?(.*?)<\/title>/i);

    if (merriamMatch?.[1]) {
      result.merriam = merriamMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
    }
  } catch (error) {
    console.error('Merriam WOTD fetch failed:', error);
  }

  try {
    const wiktionaryResponse = await fetch('https://en.wiktionary.org/w/api.php?action=featuredfeed&feed=wotd&format=xml', fetchOptions);
    const wiktionaryXml = await wiktionaryResponse.text();
    const items = wiktionaryXml.split('<item>');
    const lastItem = items[items.length - 1] || wiktionaryXml;
    const wiktionaryMatch =
      lastItem.match(/id=&quot;WOTD-rss-title&quot;&gt;(.*?)&lt;\/span&gt;/i) ||
      lastItem.match(/id="WOTD-rss-title">(.*?)<\/span>/i) ||
      lastItem.match(/<title>(?:Word of the day for .*: )?(.*?)<\/title>/i);

    if (wiktionaryMatch?.[1]) {
      result.wiktionary = wiktionaryMatch[1].replace(/<[^>]*>/g, '').trim();
    }
  } catch (error) {
    console.error('Wiktionary WOTD fetch failed:', error);
  }

  wotdCache = {
    data: result,
    timestamp: Date.now(),
  };

  return result;
}

async function buildWidgetAccountPayload(authUserId: string, useStoredPreference = true) {
  if (!useStoredPreference) {
    return {
      ok: true,
      authUserId: 'guest',
      preference: {
        auth_user_id: 'guest',
        ...defaultWidgetPreference,
      },
      personalDates: [],
    };
  }

  const [preference, personalDates] = await Promise.all([
    getUserPreference(authUserId),
    getUserEvents(authUserId),
  ]);

  return {
    ok: true,
    authUserId,
    preference: preference || {
      auth_user_id: authUserId,
      ...defaultWidgetPreference,
    },
    personalDates,
  };
}

async function buildWidgetResolvedPayload(req: express.Request) {
  const authUser = await getAuthUser(req);
  const authUserId = getWidgetUserId(authUser);
  const canEditDefaults = await hasAdminAccess(req, authUser);
  const [publicEvents, personalEvents, preference] = await Promise.all([
    canEditDefaults ? getEvents() : Promise.resolve([]),
    authUser ? getUserEvents(authUserId) : Promise.resolve([]),
    authUser ? getUserPreference(authUserId) : Promise.resolve(null),
  ]);
  const events = [...publicEvents, ...personalEvents];
  const sortedEvents = sortEventsByNextOccurrence(events);

  return {
    ok: true,
    auth: {
      canEditDefaults,
    },
    resolved: {
      locationLabel: preference?.location_label || 'San Francisco, California',
      latitude: Number(preference?.latitude ?? defaultWidgetPreference.latitude),
      longitude: Number(preference?.longitude ?? defaultWidgetPreference.longitude),
      weatherUnit: preference?.weather_unit || defaultWidgetPreference.weather_unit,
      specialDates: events,
      nextSpecialDate: sortedEvents[0] || null,
    },
  };
}

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>JeffersonWM API</title></head>
      <body>
        <h1>JeffersonWM API</h1>
        <p>Widget ownership is moving here from Lionship.</p>
        <ul>
          <li><code>/health</code> returns API and database status</li>
          <li><code>/api/widget/resolved</code> returns widget defaults and public data</li>
          <li><code>/api/widget/schema</code> describes the expected widget database tables</li>
        </ul>
      </body>
    </html>
  `);
});

app.get('/health', async (_req, res) => {
  let dbOk = false;
  let dbError = '';

  if (pool) {
    try {
      await pool.query('SELECT 1');
      dbOk = true;
    } catch (error) {
      dbError = error instanceof Error ? error.message : 'Unknown database error';
    }
  }

  res.json({
    ok: true,
    app: 'jeffersonwm',
    widgetOwner: 'jeffersonwm',
    dbConfigured: isDbConfigured,
    dbOk,
    dbError,
    writeAccess: adminToken ? 'token-required' : 'disabled',
  });
});

app.get('/api/widget/schema', (_req, res) => {
  res.json({
    ok: true,
    tables: [
      'widget_defaults',
      'widget_fonts',
      'widget_special_dates',
      'user_widget_preferences',
      'user_widget_special_dates',
    ],
    migrationSources: ['jeffers4_dates.events', 'jeffers4_fonts.fonts'],
  });
});

app.get('/api/account/me', (_req, res) => {
  const username = getCurrentUserId();

  res.json({
    ok: true,
    authenticated: false,
    username,
    displayName: process.env.JEFFERSONWM_DEV_DISPLAY_NAME || username,
    authProvider: 'pending',
  });
});

app.get('/api/account/widget', async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    res.json(await buildWidgetAccountPayload(getWidgetUserId(authUser), Boolean(authUser)));
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Account widget data could not be loaded.',
    });
  }
});

app.get('/api/widget/preferences', async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    res.json(await buildWidgetAccountPayload(getWidgetUserId(authUser), Boolean(authUser)));
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Widget preferences could not be loaded.',
    });
  }
});

app.get('/api/locations/search', async (req, res) => {
  const query = String(req.query.q || '').trim();

  if (query.length < 3) {
    res.json({ ok: true, suggestions: [] });
    return;
  }

  if (!geoapifyApiKey) {
    res.status(503).json({
      ok: false,
      error: 'Geoapify is not configured.',
    });
    return;
  }

  try {
    const params = new URLSearchParams({
      text: query,
      type: 'city',
      format: 'json',
      limit: '6',
      bias: 'countrycode:us',
      apiKey: geoapifyApiKey,
    });
    const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`);

    if (!response.ok) {
      res.status(response.status).json({
        ok: false,
        error: `Geoapify returned HTTP ${response.status}.`,
      });
      return;
    }

    const payload = await response.json() as { results?: Record<string, unknown>[] };
    const seen = new Set<string>();
    const suggestions = (payload.results || [])
      .map(normalizeGeoapifyResult)
      .filter((suggestion): suggestion is LocationSuggestion => Boolean(suggestion))
      .filter(suggestion => {
        const key = `${suggestion.city}|${suggestion.region}|${suggestion.country}`.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .sort((a, b) => scoreLocationSuggestion(b, query) - scoreLocationSuggestion(a, query));

    res.json({ ok: true, suggestions });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Location search failed.',
    });
  }
});

app.put('/api/account/widget/preferences', async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).json({ ok: false, error: 'Sign in before saving widget preferences.' });
    return;
  }

  const authUserId = getWidgetUserId(authUser);
  const locationLabel = String(req.body?.location_label || '').trim() || null;
  const latitude = req.body?.latitude === '' || req.body?.latitude === null ? null : Number(req.body?.latitude);
  const longitude = req.body?.longitude === '' || req.body?.longitude === null ? null : Number(req.body?.longitude);
  const weatherUnit = String(req.body?.weather_unit || 'fahrenheit').toLowerCase() === 'celsius' ? 'celsius' : 'fahrenheit';

  if ((latitude !== null && !Number.isFinite(latitude)) || (longitude !== null && !Number.isFinite(longitude))) {
    res.status(400).json({ ok: false, error: 'Latitude and longitude must be numbers when provided.' });
    return;
  }

  await db.execute(
    `INSERT INTO user_widget_preferences (auth_user_id, location_label, latitude, longitude, weather_unit)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       location_label = VALUES(location_label),
       latitude = VALUES(latitude),
       longitude = VALUES(longitude),
       weather_unit = VALUES(weather_unit)`,
    [authUserId, locationLabel, latitude, longitude, weatherUnit],
  );

  res.json({ ok: true });
});

app.put('/api/widget/preferences', async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).json({ ok: false, error: 'Sign in before saving widget preferences.' });
    return;
  }

  const authUserId = getWidgetUserId(authUser);
  const locationLabel = String(req.body?.location_label || '').trim() || null;
  const latitude = req.body?.latitude === '' || req.body?.latitude === null ? null : Number(req.body?.latitude);
  const longitude = req.body?.longitude === '' || req.body?.longitude === null ? null : Number(req.body?.longitude);
  const weatherUnit = String(req.body?.weather_unit || 'fahrenheit').toLowerCase() === 'celsius' ? 'celsius' : 'fahrenheit';

  if ((latitude !== null && !Number.isFinite(latitude)) || (longitude !== null && !Number.isFinite(longitude))) {
    res.status(400).json({ ok: false, error: 'Latitude and longitude must be numbers when provided.' });
    return;
  }

  await db.execute(
    `INSERT INTO user_widget_preferences (auth_user_id, location_label, latitude, longitude, weather_unit)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       location_label = VALUES(location_label),
       latitude = VALUES(latitude),
       longitude = VALUES(longitude),
       weather_unit = VALUES(weather_unit)`,
    [authUserId, locationLabel, latitude, longitude, weatherUnit],
  );

  res.json({ ok: true });
});

app.post('/api/account/widget/special-dates', async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).json({ ok: false, error: 'Sign in before saving personal dates.' });
    return;
  }

  const authUserId = getWidgetUserId(authUser);
  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.description || '').trim() || null;
  const date = normalizeOptionalDateValue(req.body?.date);
  const endDate = normalizeOptionalDateValue(req.body?.end_date);

  if (!name || !date) {
    res.status(400).json({ ok: false, error: 'Expected name and date.' });
    return;
  }

  await db.execute(
    `INSERT INTO user_widget_special_dates (auth_user_id, name, description, date, end_date)
     VALUES (?, ?, ?, ?, ?)`,
    [authUserId, name, description, date, endDate],
  );

  res.json({ ok: true });
});

app.delete('/api/account/widget/special-dates/:id', async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).json({ ok: false, error: 'Sign in before deleting personal dates.' });
    return;
  }

  await db.execute('DELETE FROM user_widget_special_dates WHERE id = ? AND auth_user_id = ?', [
    req.params.id,
    getWidgetUserId(authUser),
  ]);

  res.json({ ok: true });
});

app.get('/api/widget/resolved', async (req, res) => {
  try {
    res.json(await buildWidgetResolvedPayload(req));
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Widget state could not be resolved.',
    });
  }
});

app.get('/api/widget/state', async (req, res) => {
  try {
    res.json(await buildWidgetResolvedPayload(req));
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Widget state could not be resolved.',
    });
  }
});

app.get('/api/widget/fonts', async (_req, res) => {
  try {
    res.json(await getFonts());
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Fonts could not be loaded.',
    });
  }
});

app.put('/api/widget/fonts/:name', requireWidgetAdmin, async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const weight = Number(req.body?.weight);
  const probability = Number(req.body?.probability ?? req.body?.weight);

  if (!Number.isFinite(weight) || weight < 1 || weight > 5 || !Number.isFinite(probability)) {
    res.status(400).json({ ok: false, error: 'Expected weight 1-5 and numeric probability.' });
    return;
  }

  await db.execute('UPDATE widget_fonts SET weight = ?, probability = ? WHERE name = ?', [
    weight,
    probability,
    req.params.name,
  ]);
  res.json({ ok: true });
});

app.get('/api/widget/all-events', requireWidgetAdmin, async (_req, res) => {
  try {
    res.json(await getEvents());
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Events could not be loaded.',
    });
  }
});

app.get('/api/widget/next-event', requireWidgetAdmin, async (_req, res) => {
  try {
    const events = await getEvents();
    res.json(sortEventsByNextOccurrence(events)[0] || null);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Next event could not be loaded.',
    });
  }
});

app.post('/api/widget/events', requireWidgetAdmin, async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const { name, description, date, end_date: endDate } = req.body || {};
  if (!name || !date) {
    res.status(400).json({ ok: false, error: 'Expected name and date.' });
    return;
  }

  await db.execute(
    'INSERT INTO widget_special_dates (name, description, date, end_date, is_public) VALUES (?, ?, ?, ?, 1)',
    [name, description || null, date, endDate || null],
  );
  res.json({ ok: true });
});

app.put('/api/widget/events/:id', requireWidgetAdmin, async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const { name, description, date, end_date: endDate } = req.body || {};
  if (!name || !date) {
    res.status(400).json({ ok: false, error: 'Expected name and date.' });
    return;
  }

  await db.execute(
    'UPDATE widget_special_dates SET name = ?, description = ?, date = ?, end_date = ? WHERE id = ?',
    [name, description || null, date, endDate || null, req.params.id],
  );
  res.json({ ok: true });
});

app.delete('/api/widget/events/:id', requireWidgetAdmin, async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  await db.execute('DELETE FROM widget_special_dates WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/widget/wotd', async (_req, res) => {
  try {
    res.json(await getWidgetWords());
  } catch (error) {
    console.error('Widget WOTD could not be loaded:', error);
    res.json(fallbackWords);
  }
});

app.listen(port, () => {
  console.log(`JeffersonWM API listening on http://localhost:${port}`);
});
