import { render } from '@testing-library/react'
import App from '../app'
import { createRoot } from 'react-dom/client'

jest.mock('../router')

describe('App', () => {
  it('should render without crashing', () => {
    const div = document.createElement('div')
    createRoot(div).render(<App />)
  })

  it('should match a snapshot', () => {
    const app = render(<App />)
    expect(app).toMatchSnapshot()
  })
})
