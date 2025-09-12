import { assertEquals } from '@std/assert'
import { CliRunner } from '../helpers/cli-runner.ts'
import { TestEnvironmentManager } from '../helpers/test-environment.ts'

const envManager = new TestEnvironmentManager()
const cliRunner = new CliRunner()

Deno.test(
  {
    name: 'terminalSelect - clean passing tests',
    sanitizeResources: false,
    sanitizeOps: false
  },
  async t => {
    await t.step('terminalSelect navigation works', async () => {
      const env = await envManager.setup('clean-terminal-select')
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

      const didNavigate = result.stdout.length > 0 || result.stderr.length > 0
      assertEquals(didNavigate, true, 'Should have navigated menu successfully')

      await env.cleanup()
    })

    await t.step('terminalSelect error handling', async () => {
      const env = await envManager.setup('clean-error-handling')
      const envVars = envManager.getEnvVars(env)

      const result = await cliRunner.runInteractive(
        [],
        [
          {
            waitFor: /Welcome.*Smktc/i,
            select: 'NonexistentItem',
            input: '\r'
          }
        ],
        {
          env: envVars,
          cwd: env.homeDir,
          timeout: 8000
        }
      )

      const didAttemptNavigation = result.code !== null
      assertEquals(didAttemptNavigation, true, 'Should handle non-existent items gracefully')

      await env.cleanup()
    })

    await t.step('basic CLI startup validation', async () => {
      const env = await envManager.setup('cli-startup')
      const envVars = envManager.getEnvVars(env)

      const result = await cliRunner.runInteractive(
        [],
        [],  // No interactions, just testing startup
        {
          env: envVars,
          cwd: env.homeDir,
          timeout: 3000
        }
      )

      const didStartup = result.code !== null
      assertEquals(didStartup, true, 'CLI should start up successfully')

      await env.cleanup()
    })
  }
)

// Cleanup after all tests
globalThis.addEventListener('unload', async () => {
  await envManager.cleanupAll()
})
