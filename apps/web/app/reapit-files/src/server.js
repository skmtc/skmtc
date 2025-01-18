import express from 'express'
import proxy from 'express-http-proxy'
import cors from 'cors'
import path from 'path'
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

console.log('Starting server...')

const server = app.listen(port, () => {
  console.log(`App is live at http://localhost:${port}`)
})



process.on('SIGTERM', () => {
  console.log('SIGTERM signal received.');
  server.close(() => {
    console.log('Closed out remaining connections');
    // Additional cleanup tasks go here, e.g., close database connection
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received.');
  server.close(() => {
    console.log('Closed out remaining connections');
    // Additional cleanup tasks go here, e.g., close database connection
    process.exit(0);
  });
});
