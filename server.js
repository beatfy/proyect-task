const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()
const port = process.env.PORT || 3000

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs')
const ERROR_LOG_PATH = path.join(LOG_DIR, 'error.log')

function safeAppendErrorLog(msg) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }
    fs.appendFileSync(ERROR_LOG_PATH, msg)
  } catch (logErr) {
    console.error('Failed to write error.log:', logErr)
  }
}

// Global error handlers — catch unhandled errors that slip through
process.on('uncaughtException', (err) => {
  const msg = `[${new Date().toISOString()}] [FATAL] UncaughtException: ${err.message}\n${err.stack}\n---\n`
  safeAppendErrorLog(msg)
  console.error('UncaughtException:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  const msg = `[${new Date().toISOString()}] [FATAL] UnhandledRejection: ${reason}\n---\n`
  safeAppendErrorLog(msg)
  console.error('UnhandledRejection:', reason)
})

app.prepare().then(() => {
  if (!dev) {
    try {
      console.log('Running database migrations...')
      execSync('npx prisma migrate deploy', { stdio: 'inherit' })
      console.log('Migrations completed')
    } catch (err) {
      console.error('Migration failed:', err)
    }
  }

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  }).listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://localhost:${port}`)
  })
})
