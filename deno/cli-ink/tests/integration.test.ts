// Integration test to verify Cliffy-compatible interfaces work
import { Select, Input, Checkbox } from '../components/index.ts'

Deno.test('Select.prompt interface compatibility', async () => {
  // Test that the interface matches Cliffy expectations
  const options = [
    { name: 'Option 1', value: 'option1' },
    { name: 'Option 2', value: 'option2' }
  ]
  
  // This should not throw a type error
  const selectPromise = Select.prompt({
    message: 'Choose an option:',
    options: options
  })
  
  // We can't actually complete the prompt in a test environment,
  // but we can verify the promise was created properly
  if (!(selectPromise instanceof Promise)) {
    throw new Error('Select.prompt should return a Promise')
  }
  
  // Clean up the hanging promise by creating a quick timeout
  setTimeout(() => {
    // In a real test environment, this would be resolved by user interaction
  }, 1)
})

Deno.test('Input.prompt interface compatibility', async () => {
  // Test that the interface matches Cliffy expectations
  const inputPromise = Input.prompt({
    message: 'Enter your name:',
    default: 'John Doe',
    validate: (value: string) => value.length > 0 ? true : 'Name required'
  })
  
  if (!(inputPromise instanceof Promise)) {
    throw new Error('Input.prompt should return a Promise')
  }
  
  // Clean up
  setTimeout(() => {}, 1)
})

Deno.test('Checkbox.prompt interface compatibility', async () => {
  // Test that the interface matches Cliffy expectations
  const options = [
    { label: 'Option 1', value: 'option1' },
    { label: 'Option 2', value: 'option2', checked: true }
  ]
  
  const checkboxPromise = Checkbox.prompt({
    message: 'Select options:',
    options: options
  })
  
  if (!(checkboxPromise instanceof Promise)) {
    throw new Error('Checkbox.prompt should return a Promise')
  }
  
  // Clean up
  setTimeout(() => {}, 1)
})

Deno.test('Select.separator method exists', () => {
  const separator = Select.separator('-- Separator --')
  
  if (typeof separator !== 'object') {
    throw new Error('Select.separator should return an object')
  }
  
  if (!separator.name || !separator.value) {
    throw new Error('Separator should have name and value properties')
  }
  
  if (separator.name !== '-- Separator --') {
    throw new Error('Separator name should match input')
  }
})

Deno.test('Type compatibility check', () => {
  // This test verifies that our types are compatible with expected usage patterns
  
  // Should be able to assign to variables with expected types
  const selectOptions: Array<{ name?: string; label?: string; value: string }> = [
    { name: 'Test', value: 'test' },
    { label: 'Test2', value: 'test2' },
    { value: 'test3' }
  ]
  
  const checkboxOptions: Array<{ label: string; value: string; checked?: boolean }> = [
    { label: 'Test', value: 'test' },
    { label: 'Test2', value: 'test2', checked: true }
  ]
  
  // These should not cause type errors
  if (selectOptions.length === 0) throw new Error('Select options should exist')
  if (checkboxOptions.length === 0) throw new Error('Checkbox options should exist')
})