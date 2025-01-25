import { createRoot } from 'react-dom/client'
import App from './core/app'

try {
  const rootElement = document.querySelector('#root') || document.body

  if (rootElement) {
    createRoot(rootElement).render(<App />)
  }
} catch (error) {
  console.error('App Crashed', error)
}
