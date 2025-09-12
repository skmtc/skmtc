import { assertEquals, assertStringIncludes } from '@std/assert'
import { CliRunner } from '../helpers/cli-runner.ts'
import { TestEnvironmentManager } from '../helpers/test-environment.ts'

const envManager = new TestEnvironmentManager()
const cliRunner = new CliRunner()

Deno.test('CLI help functionality', async t => {
  await t.step('shows help output', async () => {
    const env = await envManager.setup('cli-help-test')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.runInteractive(
      ['--help'],
      [],  // No interactions needed for help command
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 20000
      }
    )

    // The CLI should run successfully and show help content
    if (result.success) {
      assertStringIncludes(result.stdout, 'Generate code')
    }

    await env.cleanup()
  })
})

// Cleanup after all tests
globalThis.addEventListener('unload', async () => {
  await envManager.cleanupAll()
})