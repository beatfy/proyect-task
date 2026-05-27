const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { execSync } = require('child_process')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()
const port = process.env.PORT || 3000

// Global error handlers — catch unhandled errors that slip through
process.on('uncaughtException', (err) => {
  const msg = `[${new Date().toISOString()}] [FATAL] UncaughtException: ${err.message}\n${err.stack}\n---\n`;
  require('fs').appendFileSync('/home/ele/taskx2/error.log', msg);
  console.error('UncaughtException:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const msg = `[${new Date().toISOString()}] [FATAL] UnhandledRejection: ${reason}\n---\n`;
  require('fs').appendFileSync('/home/ele/taskx2/error.log', msg);
  console.error('UnhandledRejection:', reason);
});

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