import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
const app = express()
const port = 3111

app.use(cors({
  origin: '*',
  allowedHeaders: ['Authorization', 'api-version'],
  credentials: true
}))

app.use(express.static('build'))

app.get('/test', (req, res) => {
  res.send('Testing')
})

app.get('*', (req, res) => {
  const resolvedPath = path.resolve('build', 'index.html')
  try {
    const file = fs.readFileSync(resolvedPath, 'utf8')
    return res.send(file)
  } catch (error) {
    return res.send(`<!doctype html>
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

console.log('Starting server...')

app.listen(port, () => {
  console.log(`App is live at http://localhost:${port}`)
})




