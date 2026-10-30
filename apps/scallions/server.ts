import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { seasonItems } from './src/data/seasonItems'

const envFile =
  process.env.SCALLIONS_ENV_FILE ||
  process.env.SCALLION_ENV_FILE ||
  (process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development')

dotenv.config({ path: path.join(process.cwd(), envFile) })

const PORT = Number(process.env.PORT || process.env.SCALLIONS_PORT || process.env.SCALLION_PORT || '8160')
const HOST = process.env.HOST || '0.0.0.0'
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`
const AUTH_BASE_URL = (process.env.SCALLIONS_AUTH_BASE_URL || process.env.AUTH_BASE_URL || 'https://auth.jeffersonwm.com').replace(/\/$/, '')
const AUTH_INTERNAL_LOG_TOKEN = (
  process.env.SCALLIONS_AUTH_INTERNAL_LOG_TOKEN ||
  process.env.AUTH_INTERNAL_LOG_TOKEN ||
  '0fd4b372cabf46e4afdae1be1a1d4fa5a49b076fa53c62b8619f2faeab1b12ee'
).trim()
const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || './data')
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const DB_HOST = process.env.JEFFERSONWM_WIDGET_DB_HOST || '143.95.39.115'
const DB_PORT = Number(process.env.JEFFERSONWM_WIDGET_DB_PORT || 3306)
const DB_USER = process.env.JEFFERSONWM_WIDGET_DB_USER || 'jeffers4_admin'
const DB_PASSWORD = process.env.JEFFERSONWM_WIDGET_DB_PASSWORD || 'D3pt0fEduc@tion'
const DB_NAME = process.env.JEFFERSONWM_WIDGET_DB_NAME || 'jeffers4_jeffwm_widget'

let pool: mysql.Pool | null = null
try {
  pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000,
  })
} catch (err) {
  console.warn('Could not initialize MySQL pool for Scallions:', err)
}

const app = express()

fs.mkdirSync(DATA_DIR, { recursive: true })

export async function logAuthHistory(action: string, target: string | Record<string, unknown>) {
  const targetStr = typeof target === 'string' ? target : JSON.stringify(target)

  try {
    await fetch(`${AUTH_BASE_URL}/api/history/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_INTERNAL_LOG_TOKEN ? { 'x-auth-internal-token': AUTH_INTERNAL_LOG_TOKEN } : {}),
      },
      body: JSON.stringify({
        action,
        site: 'scallions',
        target: targetStr,
        userId: null,
        username: 'visitor',
        internalToken: AUTH_INTERNAL_LOG_TOKEN,
      }),
    })
  } catch (error) {
    console.warn('Scallions could not log to Auth history:', error)
  }
}

app.use(express.json({ limit: '32kb' }))
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Origin not allowed by CORS'))
    },
  }),
)

app.get('/health', (_req, res) => {
  res.json({ ok: true, app: 'scallions', publicBaseUrl: PUBLIC_BASE_URL })
})

app.get('/api/fonts', async (_req, res) => {
  if (pool) {
    try {
      const [rows] = await pool.query(
        'SELECT name FROM widget_fonts WHERE scallions = 1 AND weight > 0 AND (hidden = 0 OR hidden IS NULL) ORDER BY name ASC'
      )
      if (Array.isArray(rows) && rows.length > 0) {
        const fonts = (rows as Array<{ name: string }>).map((r) => r.name)
        res.json({ ok: true, fonts })
        return
      }
    } catch (error) {
      console.warn('Failed to query widget_fonts from MySQL:', error)
    }
  }

  res.json({ ok: true, fonts: [] })
})

app.get('/api/items', async (_req, res) => {
  if (pool) {
    try {
      const [rows] = await pool.query(
        'SELECT id, name, category, start_month AS startMonth, start_day AS startDay, end_month AS endMonth, end_day AS endDay FROM scallions_items ORDER BY name ASC'
      )
      if (Array.isArray(rows) && rows.length > 0) {
        res.json({ ok: true, items: rows })
        return
      }
    } catch {
      try {
        // Fallback to scallion_items if scallions_items is not created yet
        const [rows] = await pool.query(
          'SELECT id, name, category, start_month AS startMonth, start_day AS startDay, end_month AS endMonth, end_day AS endDay FROM scallion_items ORDER BY name ASC'
        )
        if (Array.isArray(rows) && rows.length > 0) {
          res.json({ ok: true, items: rows })
          return
        }
      } catch (innerError) {
        console.warn('Failed to query items from MySQL, falling back to local dataset:', innerError)
      }
    }
  }

  res.json({ ok: true, items: seasonItems })
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(process.cwd(), 'dist')))
  app.use((_req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'))
  })
}

app.listen(PORT, HOST, () => {
  console.log(`Scallions running on ${PUBLIC_BASE_URL}`)
})
