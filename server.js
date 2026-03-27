const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { execSync } = require('child_process')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()
const port = process.env.PORT || 3000

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