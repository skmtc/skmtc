# SKMTC CLI-Ink

A React-based CLI implementation of the SKMTC CLI using Ink components instead of Cliffy prompts.

## Overview

This project replaces Cliffy's interactive prompts with Ink React components while maintaining the same command structure and interfaces. The primary benefit is **significantly improved testability** using standard React testing patterns.

## Key Features

### 🔧 **Drop-in Replacement**
- Maintains identical async `prompt()` interfaces as Cliffy
- All existing command logic works unchanged
- Same keyboard navigation and user experience

### 🧪 **Enhanced Testability**
- Uses `ink-testing-library` for comprehensive component testing
- Standard React testing patterns with `render()`, `lastFrame()`, and input simulation
- Easy to test user interactions, validation, and UI state changes

### 🎨 **Modern Architecture** 
- React component-based architecture
- Rich text styling and layout capabilities with Ink's Flexbox-like system
- TypeScript support with proper type safety

## Components

### `InkSelect`
- Dropdown selection with keyboard navigation (↑/↓ arrows)
- Supports separators and custom option formatting
- Compatible with Cliffy's `Select.prompt()` interface

### `InkInput`
- Text input with validation support
- Auto-suggestions and list mode
- Real-time error display and feedback

### `InkCheckbox`
- Multi-select checkboxes with space bar toggling
- Pre-checked options support
- Keyboard navigation between options

## Testing Examples

```typescript
// Test component rendering
const { lastFrame } = render(
  <InkSelect 
    message="Choose an option:"
    options={[{ name: 'Option 1', value: 'opt1' }]}
    onSubmit={() => {}}
  />
)

const output = lastFrame()
expect(output).toContain('Choose an option:')
expect(output).toContain('> Option 1') // Selected indicator

// Test keyboard interactions
const { stdin } = render(<InkInput message="Name:" onSubmit={callback} />)
stdin.write('hello')  // Type text
stdin.write('\r')     // Submit with Enter

// Test validation
const validator = (value: string) => value.length >= 3 ? true : 'Too short'
render(<InkInput message="Name:" validate={validator} onSubmit={callback} />)
```

## Running Tests

```bash
# Test all components
deno task test:components

# Watch mode for development
deno task test:watch

# Run specific test file  
deno test tests/components/InkSelect.test.tsx --allow-all --no-check
```

## Migration from Cliffy

The migration is seamless - simply replace import statements:

```typescript
// Before (Cliffy)
import { Select, Input, Checkbox } from '@cliffy/prompt'

// After (Ink)  
import { Select, Input, Checkbox } from './components/index.ts'
```

All existing usage remains the same:

```typescript
const name = await Input.prompt({ message: 'Your name?' })
const choice = await Select.prompt({ message: 'Pick one:', options: [...] })
const items = await Checkbox.prompt({ message: 'Select items:', options: [...] })
```

## Dependencies

- **React 19** - Modern React with latest features
- **Ink 6** - React for terminal interfaces  
- **Ink Testing Library 4** - Testing utilities for Ink components
- **TypeScript** - Full type safety throughout

## Benefits over Cliffy

1. **Testability** - Easy unit testing with standard React patterns
2. **Debuggability** - React DevTools support and component inspection
3. **Maintainability** - Modern component architecture
4. **Extensibility** - Easy to customize and extend components
5. **Consistency** - Unified React patterns across the entire CLI

## License

[FSL-1.1-ALv2](LICENSE)