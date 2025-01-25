import { FC, useEffect } from 'react'
import { render } from '@testing-library/react'
import { ErrorBoundary } from '..'

const Component: FC = () => <div>I am a component!</div>
const DangerousComponent: FC = () => {
  useEffect(() => {
    throw new Error('Error')
  })
  return <div>I am a dangerous component!</div>
}

describe('ErrorBoundary', () => {
  it('should match a snapshot', () => {
    expect(
      render(
        <ErrorBoundary>
          <Component />
        </ErrorBoundary>,
      ),
    ).toMatchSnapshot()
  })

  it('should match a snapshot if the component throws', () => {
    expect(
      render(
        <ErrorBoundary>
          <DangerousComponent />
        </ErrorBoundary>,
      ),
    ).toMatchSnapshot()
  })
})
