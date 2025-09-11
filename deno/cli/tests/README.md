# SKMTC CLI Test Suite

This test suite follows the principles from ["Testing The CLI The Way People Use It"](https://www.smashingmagazine.com/2022/04/testing-cli-way-people-use-it/) to test the SKMTC CLI as users actually interact with it.

## Philosophy

The core testing philosophy: **"The more your tests resemble the way your software is used, the more confidence they can give you."**

Our tests focus on:
- User interactions rather than implementation details
- Complete end-to-end workflows
- Isolated test environments
- Real subprocess execution

## Structure

```
tests/
├── integration/           # Integration tests
│   ├── init.test.ts      # Init command tests
│   └── prompt.test.ts    # Interactive prompt tests
├── helpers/              # Test utilities
│   ├── cli-runner.ts     # CLI subprocess execution wrapper
│   └── test-environment.ts # Test environment setup
└── fixtures/             # Test data and mock schemas
    └── example-schema.json
```

## Running Tests

```bash
# Run all tests
deno task test

# Run tests in watch mode
deno task test:watch

# Run with coverage
deno task test:coverage

# Run specific test file
deno test --allow-all tests/integration/init.test.ts
```

## Test Helpers

### CliRunner

Executes the CLI as a subprocess and captures output:

```typescript
const runner = new CliRunner()

// Run command with arguments
const result = await runner.run({
  args: ['init', 'my-project', '@skmtc/gen-typescript', './src'],
  env: { HOME: '/tmp/test-home' },
})

// Run interactive session
const result = await runner.runInteractive([], [
  { waitFor: 'Choose a name', input: 'my-project\n' },
  { waitFor: 'Select generators', input: ' \n' },
])
```

### TestEnvironmentManager

Creates isolated test environments:

```typescript
const envManager = new TestEnvironmentManager()
const env = await envManager.setup('test-name')

// Use the environment
const envVars = envManager.getEnvVars(env)
// ... run tests ...

// Cleanup
await env.cleanup()
```

## Test Coverage

### Currently Working Tests
- ✅ CLI help and command validation
- ✅ Command parsing and argument validation
- ✅ Error handling for unknown commands
- ✅ Basic CLI infrastructure

### Tests Requiring Mocks (See MOCKING_GUIDE.md)
- 🔄 Init command project creation
- 🔄 Name validation (min length, duplicates)
- 🔄 Generator selection and dependency resolution
- 🔄 Base path configuration
- 🔄 Interactive prompt flow
- 🔄 Prompt navigation between screens
- 🔄 Authentication flow testing
- 🔄 Network error handling

**Note**: The comprehensive init and prompt tests are implemented but require mocking external dependencies (Supabase, JSR, remote APIs) to run successfully. See `MOCKING_GUIDE.md` for implementation details.

## Key Testing Patterns

1. **Isolation**: Each test runs in its own temporary directory
2. **Subprocess Execution**: Tests run the actual CLI binary
3. **Interactive Testing**: Simulates user keyboard input
4. **Output Normalization**: Handles platform-specific differences
5. **Snapshot Testing**: Captures expected outputs
6. **Mock Dependencies**: Isolates tests from external services

## Best Practices

1. **Test User Workflows**: Focus on what users do, not how code works
2. **Keep Tests Fast**: Each test should complete in < 2 seconds
3. **Clean Up**: Always cleanup temporary resources
4. **Deterministic**: Mock time-based and random values
5. **Descriptive Names**: Use clear test descriptions
6. **Error Scenarios**: Test both success and failure paths

## Adding New Tests

1. Create test file in appropriate directory
2. Import test helpers
3. Set up test environment
4. Execute CLI commands
5. Assert expected behavior
6. Clean up resources

Example:

```typescript
import { assertEquals } from '@std/assert'
import { CliRunner } from '../helpers/cli-runner.ts'
import { TestEnvironmentManager } from '../helpers/test-environment.ts'

Deno.test('my new feature', async (t) => {
  const envManager = new TestEnvironmentManager()
  const runner = new CliRunner()
  
  await t.step('does something useful', async () => {
    const env = await envManager.setup('test-name')
    const envVars = envManager.getEnvVars(env)
    
    const result = await runner.run({
      args: ['my-command'],
      env: envVars,
    })
    
    assertEquals(result.success, true)
    await env.cleanup()
  })
})
```

## Troubleshooting

- **Tests hang**: Check for unclosed processes or infinite loops
- **Flaky tests**: Ensure proper isolation and cleanup
- **Platform differences**: Use output normalization
- **Permission errors**: Ensure `--allow-all` flag is used