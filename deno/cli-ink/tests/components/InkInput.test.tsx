import { render } from 'ink-testing-library'
import { InkInput } from '../../components/InkInput.tsx'
import { assertEquals } from '@std/assert'

Deno.test('InkInput - renders message and cursor', () => {
  const { lastFrame, unmount } = render(<InkInput message="Enter your name:" onSubmit={() => {}} />)

  const output = lastFrame()

  const expectedOutput = `Enter your name:
> _`

  assertEquals(output, expectedOutput)

  unmount()
})

Deno.test('InkInput - typing input', () => {
  const component = <InkInput message="Enter your name:" onSubmit={() => {}} />

  const { lastFrame, stdin, unmount, rerender } = render(component)

  // Type some characters
  stdin.write('hello')

  rerender(component)

  const output = lastFrame()

  const expectedOutput = `Enter your name:
> hello_`

  assertEquals(output, expectedOutput)

  unmount()
})

Deno.test('InkInput - backspace handling', () => {
  const component = <InkInput message="Enter your name:" onSubmit={() => {}} />

  const { lastFrame, stdin, unmount, rerender } = render(component)

  // Type some characters
  stdin.write('hello')
  rerender(component)

  let output = lastFrame()
  let expectedOutput = `Enter your name:
> hello_`

  assertEquals(output, expectedOutput)

  // Simulate backspace
  stdin.write('\u0008') // Backspace character
  rerender(component)

  output = lastFrame()

  // Should show 'hell' after backspace
  expectedOutput = `Enter your name:
> hell_`

  assertEquals(output, expectedOutput)

  unmount()
})

Deno.test('InkInput - validation error display', () => {
  const validator = (value: string) => {
    if (value.length < 3) {
      return 'Name must be at least 3 characters'
    }
    return true
  }

  const component = <InkInput message="Enter your name:" validate={validator} onSubmit={() => {}} />

  const { lastFrame, stdin, unmount, rerender } = render(component)

  // Type short input
  stdin.write('hi')
  rerender(component)

  // Try to submit with Enter
  stdin.write('\r')
  rerender(component)

  const output = lastFrame()

  // Should show validation error
  const expectedOutput = `Enter your name:
> hi_
Name must be at least 3 characters`

  assertEquals(output, expectedOutput)

  unmount()
})

Deno.test('InkInput - default value', () => {
  const { lastFrame, unmount } = render(
    <InkInput message="Enter your name:" defaultValue="John" onSubmit={() => {}} />
  )

  const output = lastFrame()

  const expectedOutput = `Enter your name:
> John_`

  assertEquals(output, expectedOutput)

  unmount()
})

Deno.test('InkInput - submission callback', () => {
  let submittedValue = ''

  const component = (
    <InkInput
      message="Enter your name:"
      onSubmit={value => {
        submittedValue = value
      }}
    />
  )

  const { stdin, unmount, rerender } = render(component)

  // Type and submit
  stdin.write('Alice')
  rerender(component)
  stdin.write('\r') // Enter key
  rerender(component)

  assertEquals(submittedValue, 'Alice')

  unmount()
})
