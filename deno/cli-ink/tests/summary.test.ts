import { Select, Input, Checkbox } from '../components/index.ts'

Deno.test('Migration compatibility verification', () => {
  // Verify that all expected interfaces exist and are properly typed
  if (typeof Select.prompt !== 'function') {
    throw new Error('Select.prompt method missing')
  }
  
  if (typeof Input.prompt !== 'function') {
    throw new Error('Input.prompt method missing')
  }
  
  if (typeof Checkbox.prompt !== 'function') {
    throw new Error('Checkbox.prompt method missing')
  }
  
  if (typeof Select.separator !== 'function') {
    throw new Error('Select.separator method missing')
  }
})