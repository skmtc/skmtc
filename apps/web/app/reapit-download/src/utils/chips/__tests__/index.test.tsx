import { render } from '@testing-library/react'
import { DisplayChip, LinkChip } from '..'

describe('DisplayChip', () => {
  it('should match a snapshot', () => {
    expect(render(<DisplayChip />)).toMatchSnapshot()
  })
})

describe('LinkChip', () => {
  it('should match a snapshot', () => {
    expect(render(<LinkChip />)).toMatchSnapshot()
  })
})
