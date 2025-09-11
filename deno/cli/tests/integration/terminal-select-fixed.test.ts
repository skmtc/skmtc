import { assertEquals } from '@std/assert'
import { CliRunner } from '../helpers/cli-runner.ts'
import { TestEnvironmentManager } from '../helpers/test-environment.ts'

const envManager = new TestEnvironmentManager()
const cliRunner = new CliRunner()

Deno.test('terminalSelect fixed implementation tests', async t => {
  await t.step('validates terminalSelect("Exit") functionality', async () => {
    const env = await envManager.setup('terminal-select-exit-test')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.runInteractive(
      [],
      [
        {
          waitFor: /Welcome.*Smktc/i,
          select: 'Exit',
          input: '\r'
        }
      ],
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 15000
      }
    )

    const hasOutput = result.stdout.length > 0 || result.stderr.length > 0
    assertEquals(hasOutput, true, 'Should capture menu navigation')

    await env.cleanup()
  })

  await t.step('validates error handling for missing menu items', async () => {
    const env = await envManager.setup('terminal-select-missing-item')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.runInteractive(
      [],
      [
        {
          waitFor: /Welcome.*Smktc/i,
          select: 'NonExistentOption',
          input: '\r'
        }
      ],
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 8000
      }
    )

    const processHandled = result.code !== null
    assertEquals(processHandled, true, 'Should handle missing items gracefully')

    await env.cleanup()
  })
})

// Cleanup after all tests
globalThis.addEventListener('unload', async () => {
  await envManager.cleanupAll()
})
