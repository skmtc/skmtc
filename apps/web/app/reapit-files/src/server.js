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



app.get('*', (req, res) => res.sendFile(path.resolve('build', 'index.html')))

console.log('Starting server...')

app.listen(port, () => {
  console.log(`App is live at http://localhost:${port}`)
})




