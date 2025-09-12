import { render } from 'ink-testing-library'
import { Select, Input, Checkbox, InkSelect, InkInput, InkCheckbox } from '../../components/index.ts'

Deno.test('InkSelect - basic rendering', () => {
  const options = [
    { name: 'Option 1', value: 'option1' },
    { name: 'Option 2', value: 'option2' }
  ]
  
  const { lastFrame, unmount } = render(
    <InkSelect 
      message="Choose an option:"
      options={options}
      onSubmit={() => {}}
    />
  )
  
  const output = lastFrame()
  
  // Clean up to prevent resource leaks
  unmount()
  
  // Basic checks that don't rely on complex interactions
  if (!output) {
    throw new Error('No output rendered')
  }
  
  if (!output.includes('Choose an option:')) {
    throw new Error('Message not found in output')
  }
  
  if (!output.includes('Option 1')) {
    throw new Error('Option 1 not found in output')
  }
  
  if (!output.includes('Option 2')) {
    throw new Error('Option 2 not found in output')
  }
})

Deno.test('InkInput - basic rendering', () => {
  const { lastFrame, unmount } = render(
    <InkInput 
      message="Enter your name:"
      onSubmit={() => {}}
    />
  )
  
  const output = lastFrame()
  
  // Clean up to prevent resource leaks
  unmount()
  
  if (!output) {
    throw new Error('No output rendered')
  }
  
  if (!output.includes('Enter your name:')) {
    throw new Error('Message not found in output')
  }
  
  // Check for basic prompt structure
  if (!output.includes('>')) {
    throw new Error('Prompt indicator not found in output')
  }
})

Deno.test('InkInput - default value rendering', () => {
  const { lastFrame, unmount } = render(
    <InkInput 
      message="Enter your name:"
      defaultValue="John Doe"
      onSubmit={() => {}}
    />
  )
  
  const output = lastFrame()
  
  // Clean up to prevent resource leaks
  unmount()
  
  if (!output) {
    throw new Error('No output rendered')
  }
  
  if (!output.includes('John Doe')) {
    throw new Error('Default value not displayed')
  }
})

Deno.test('InkCheckbox - basic rendering', () => {
  const options = [
    { label: 'Option 1', value: 'option1' },
    { label: 'Option 2', value: 'option2', checked: true }
  ]
  
  const { lastFrame, unmount } = render(
    <InkCheckbox 
      message="Select options:"
      options={options}
      onSubmit={() => {}}
    />
  )
  
  const output = lastFrame()
  
  // Clean up to prevent resource leaks  
  unmount()
  
  if (!output) {
    throw new Error('No output rendered')
  }
  
  if (!output.includes('Select options:')) {
    throw new Error('Message not found in output')
  }
  
  if (!output.includes('Option 1')) {
    throw new Error('Option 1 not found in output')
  }
  
  if (!output.includes('Option 2')) {
    throw new Error('Option 2 not found in output')
  }
  
  // Check for checkbox indicators
  if (!output.includes('[') || !output.includes(']')) {
    throw new Error('Checkbox indicators not found')
  }
})

Deno.test('Component interfaces are compatible', () => {
  // Test that our components have the expected interface structure
  // This verifies the drop-in replacement capability
  
  if (typeof Select !== 'object') {
    throw new Error('Select should be an object')
  }
  
  if (typeof Input !== 'object') {
    throw new Error('Input should be an object')
  }
  
  if (typeof Checkbox !== 'object') {
    throw new Error('Checkbox should be an object')
  }
  
  // Check that prompt methods exist
  const selectHasPrompt = 'prompt' in Select && typeof Select.prompt === 'function'
  const inputHasPrompt = 'prompt' in Input && typeof Input.prompt === 'function'  
  const checkboxHasPrompt = 'prompt' in Checkbox && typeof Checkbox.prompt === 'function'
  
  if (!selectHasPrompt) {
    throw new Error('Select.prompt method missing')
  }
  
  if (!inputHasPrompt) {
    throw new Error('Input.prompt method missing')
  }
  
  if (!checkboxHasPrompt) {
    throw new Error('Checkbox.prompt method missing')
  }
  
  // Check that React components exist
  if (typeof InkSelect !== 'function') {
    throw new Error('InkSelect component should be a function')
  }
  
  if (typeof InkInput !== 'function') {
    throw new Error('InkInput component should be a function')
  }
  
  if (typeof InkCheckbox !== 'function') {
    throw new Error('InkCheckbox component should be a function')
  }
})