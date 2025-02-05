import { Hono } from 'hono'
import path from 'path'
import fs from 'fs'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { logger } from 'hono/logger'
import { serveStatic } from '@hono/node-server/serve-static'
import { mockServer } from './core/mock-server.generated.js'

const app = new Hono()
app.use(logger())
app.use(cors({
  origin: '*',
  allowedHeaders: ['Authorization', 'api-version'],
  credentials: true
}))

app.route('/api', mockServer)

app.get('/assets/*', serveStatic({ root: './build' }))

app.get('*', c => {
  const resolvedPath = path.resolve('build', 'index.html')

  try {
    const file = fs.readFileSync(resolvedPath, 'utf8')

    if(resolvedPath.endsWith('.html')) {
      return c.html(file)
    }

    if(resolvedPath.endsWith('.js')) {
      c.header('Content-Type', 'text/javascript')
      return c.text(file)
    }

    if(resolvedPath.endsWith('.css')) {
      c.header('Content-Type', 'text/css')
      return c.text(file)
    }

    if(resolvedPath.endsWith('.json')) {
      c.header('Content-Type', 'application/json')
      return c.json(file)
    }

    throw new Error(`Unknown file type: '${resolvedPath}'`)

  } catch (error) {
    return c.html(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <link rel="icon" href="/favicon.ico" />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
          <link rel="apple-touch-icon" href="/pwa-192x192.png" sizes="180x180" />
          <link rel="mask-icon" href="/pwa-152x152.png" color="#fff" />
          <meta name="theme-color" content="#fff" />
          <title>Foundations App</title>
        </head>
        <body>
          <div id="root">Loading...</div>
        </body>
      </html>
    `)
  }
})

serve({fetch: app.fetch,port: 3111})




