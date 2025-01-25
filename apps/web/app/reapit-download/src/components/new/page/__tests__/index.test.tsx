import NewPage from '..'
import { render } from '../../../../scripts/tests'

describe('NewPage', () => {
  it('should match a snapshot', () => {
    expect(render(<NewPage />)).toMatchSnapshot()
  })
})
