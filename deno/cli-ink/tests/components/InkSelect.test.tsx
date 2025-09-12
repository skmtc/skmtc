import { render } from 'ink-testing-library'
import { InkSelect } from '../../components/InkSelect.tsx'
import { assertEquals } from '@std/assert'

Deno.test('InkSelect - renders options correctly', () => {
  const options = [
    { name: 'Option 1', value: 'option1' },
    { name: 'Option 2', value: 'option2' },
    { name: 'Option 3', value: 'option3' }
  ]

  const { lastFrame, unmount } = render(
    <InkSelect message="Choose an option:" options={options} onSubmit={() => {}} />
  )

  const output = lastFrame()

  const expectedOutput = `Choose an option:
> Option 1
  Option 2
  Option 3`

  assertEquals(output, expectedOutput)

  unmount()
})

Deno.test('InkSelect - keyboard navigation', () => {
  const options = [
    { name: 'Option 1', value: 'option1' },
    { name: 'Option 2', value: 'option2' }
  ]

  const component = <InkSelect message="Choose an option:" options={options} onSubmit={() => {}} />

  const { lastFrame, stdin, unmount, rerender } = render(component)

  // Initially, first option should be selected
  let output = lastFrame()

  const expectedOutput = `Choose an option:
> Option 1
  Option 2`

  assertEquals(output, expectedOutput)

  // Simulate down arrow key
  stdin.write('\u001B[B') // Down arrow escape sequence

  rerender(component)

  output = lastFrame()

  // After down arrow, second option should be selected
  const expectedOutput2 = `Choose an option:
  Option 1
> Option 2`

  assertEquals(output, expectedOutput2)

  unmount()
})

Deno.test('InkSelect - selection callback', () => {
  const options = [
    { name: 'Option 1', value: 'option1' },
    { name: 'Option 2', value: 'option2' }
  ]

  let selectedValue = ''

  const component = (
    <InkSelect
      message="Choose an option:"
      options={options}
      onSubmit={value => {
        selectedValue = value
      }}
    />
  )

  const { stdin, unmount, rerender } = render(component)

  // Simulate Enter key to select first option
  stdin.write('\r') // Enter key

  rerender(component)

  assertEquals(selectedValue, 'option1')

  unmount()
})
