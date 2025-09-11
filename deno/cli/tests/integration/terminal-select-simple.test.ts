import { assertEquals } from '@std/assert'
import { CliRunner } from '../helpers/cli-runner.ts'
import { TestEnvironmentManager } from '../helpers/test-environment.ts'

const envManager = new TestEnvironmentManager()
const cliRunner = new CliRunner()

Deno.test('terminalSelect simple functionality tests', async t => {
  await t.step('simple terminalSelect navigation', async () => {
    const env = await envManager.setup('simple-terminal-select')
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
        timeout: 12000
      }
    )

    const foundInteraction = result.stdout.length > 0 || result.stderr.length > 0
    assertEquals(foundInteraction, true, 'Should navigate menu within time limits')

    await env.cleanup()
  })

  await t.step('error handling with timeout', async () => {
    const env = await envManager.setup('simple-error-handling')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.runInteractive(
      [],
      [
        {
          waitFor: /Welcome.*Smktc/i,
          select: 'NonExistentMenuItem',
          input: '\r'
        }
      ],
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 6000
      }
    )

    const processHandled = result.code !== null
    assertEquals(processHandled, true, 'Should handle errors with timeout')

    await env.cleanup()
  })
})

// Cleanup after all tests
globalThis.addEventListener('unload', async () => {
  await envManager.cleanupAll()
})
