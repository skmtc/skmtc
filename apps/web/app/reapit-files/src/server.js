import express from 'express'
import cors from 'cors'
import path from 'path'
const app = express()
const port = 3111

app.use(cors())

app.use(express.static('build'))

app.get('/test', (req, res) => {
  res.send('Testing')
})

app.get('*', (req, res) => res.sendFile(path.resolve('build', 'index.html')))

app.listen(port, () => {
  console.log(`App is live at http://localhost:${port}`)
})
