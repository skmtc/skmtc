import { Wrapper } from '../wrapper'
import { render } from '../../../../scripts/tests'

describe('Wrapper', () => {
  it('should match a snapshot', () => {
    expect(render(<Wrapper />)).toMatchSnapshot()
  })
})
