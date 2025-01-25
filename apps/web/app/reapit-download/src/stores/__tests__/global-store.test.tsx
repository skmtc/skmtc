import { render, fireEvent, act } from '@testing-library/react'
import { useGlobalStore } from '../global-store'

const MockComponent = () => {
  const { globalState, setGlobalState } = useGlobalStore()

  return (
    <div>
      <span>{globalState['foo']}</span>
      <button onClick={() => setGlobalState({ foo: 'bar' })}>Update</button>
    </div>
  )
}

describe('useGlobalStore', () => {
  it('should update global state', () => {
    const { getByText } = render(<MockComponent />)

    act(() => {
      fireEvent.click(getByText('Update'))
    })

    expect(getByText('bar')).toBeInTheDocument()
  })
})
