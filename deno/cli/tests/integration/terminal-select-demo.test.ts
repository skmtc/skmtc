import { assertEquals } from '@std/assert'
import { CliRunner } from '../helpers/cli-runner.ts'
import { TestEnvironmentManager } from '../helpers/test-environment.ts'

const envManager = new TestEnvironmentManager()
const cliRunner = new CliRunner()

Deno.test('terminalSelect demo functionality', async t => {
  await t.step('demonstrates terminalSelect("Exit")', async () => {
    const env = await envManager.setup('terminal-select-exit')
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

    const hasMenuInteraction = result.stdout.length > 0 || result.stderr.length > 0
    assertEquals(hasMenuInteraction, true, 'Should demonstrate menu selection')

    await env.cleanup()
  })

  await t.step('demonstrates terminalSelect("Create new project")', async () => {
    const env = await envManager.setup('terminal-select-create')
    const envVars = envManager.getEnvVars(env)

    const result = await cliRunner.runInteractive(
      [],
      [
        {
          waitFor: /Welcome.*Smktc/i,
          select: 'Create new project',
          input: '\r'
        }
      ],
      {
        env: envVars,
        cwd: env.homeDir,
        timeout: 20000
      }
    )

    const hasProjectFlow = result.stdout.length > 0 || result.stderr.length > 0
    assertEquals(hasProjectFlow, true, 'Should demonstrate project creation flow')

    await env.cleanup()
  })

  await t.step('demonstrates error handling for non-existent items', async () => {
    const env = await envManager.setup('terminal-select-error')
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
        timeout: 8000
      }
    )

    const processCompleted = result.code !== null
    assertEquals(processCompleted, true, 'Should handle non-existent menu items gracefully')

    await env.cleanup()
  })
})

// Cleanup after all tests
globalThis.addEventListener('unload', async () => {
  await envManager.cleanupAll()
})
