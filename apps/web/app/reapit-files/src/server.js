import express from 'express'
import proxy from 'express-http-proxy'
import cors from 'cors'
import path from 'path'
const app = express()
const port = 3111

app.use(cors())

app.use(express.static('build'))

app.get('/test', (req, res) => {
  res.send('Testing')
})

app.use('/api', (req, res, next) => {
  console.log("URL", req.url)
  proxy('platform.reapit.cloud', {
    https: true,
    userResDecorator: (proxyRes, userReq, userRes) => {
      console.log("RES HEADERS", proxyRes.headers)

      return proxyRes
    }
  })(req, res, next)
})

app.get('*', (req, res) => res.sendFile(path.resolve('build', 'index.html')))

app.listen(port, () => {
  console.log(`App is live at http://localhost:${port}`)
})
