import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'

const envFile =
  process.env.IWENTTOCITY_ENV_FILE ||
  (process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development')

dotenv.config({ path: path.join(process.cwd(), envFile) })

const PORT = Number(process.env.PORT || process.env.IWENTTOCITY_PORT || '8150')
const HOST = process.env.HOST || '0.0.0.0'
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`
const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || './data')
const SUBMISSIONS_PATH = path.join(DATA_DIR, 'email-interest.jsonl')
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const app = express()

fs.mkdirSync(DATA_DIR, { recursive: true })

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
  res.json({ ok: true, app: 'iwenttocity', publicBaseUrl: PUBLIC_BASE_URL })
})

app.post('/api/interest', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ ok: false, error: 'Enter a valid email address.' })
    return
  }

  const entry = {
    email,
    createdAt: new Date().toISOString(),
    source: String(req.body?.source || 'interest-form').slice(0, 80),
  }

  fs.appendFileSync(SUBMISSIONS_PATH, `${JSON.stringify(entry)}\n`, 'utf8')
  res.status(201).json({ ok: true })
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(process.cwd(), 'dist')))
  app.use((_req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'))
  })
}

app.listen(PORT, HOST, () => {
  console.log(`I Went to City running on ${PUBLIC_BASE_URL}`)
})
