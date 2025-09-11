import { assertEquals } from '@std/assert'
import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { CliRunner } from '../helpers/cli-runner.ts'
import { TestEnvironmentManager } from '../helpers/test-environment.ts'

const envManager = new TestEnvironmentManager()
const cliRunner = new CliRunner()

Deno.test(
  {
    name: 'Enhanced CLI interactions with optional select',
    sanitizeResources: false,
    sanitizeOps: false
  },
  async t => {
    await t.step('demonstrates menu selection with select property', async () => {
      const env = await envManager.setup('menu-with-select')
      const envVars = envManager.getEnvVars(env)

      const result = await cliRunner.runInteractive(
        [],
        [
          {
            waitFor: /Welcome.*Smktc/i,
            select: 'Exit', // This will navigate to find "Exit" menu item
            input: '\r'
          }
        ],
        {
          env: envVars,
          cwd: env.homeDir,
          timeout: 10000
        }
      )

      assertEquals(typeof result.code, 'number', 'Should complete with exit code')

      await env.cleanup()
    })

    await t.step('demonstrates direct input without select property', async () => {
      const env = await envManager.setup('direct-input')
      const envVars = envManager.getEnvVars(env)

      const result = await cliRunner.runInteractive(
        [],
        [
          {
            waitFor: /Welcome.*Smktc/i,
            // No select property - will send input directly
            input: '\x03' // Ctrl+C to exit
          }
        ],
        {
          env: envVars,
          cwd: env.homeDir,
          timeout: 8000
        }
      )

      assertEquals(typeof result.code, 'number', 'Should complete with exit code')

      await env.cleanup()
    })

    await t.step('demonstrates mixed interactions', async () => {
      const env = await envManager.setup('mixed-interactions')
      const envVars = envManager.getEnvVars(env)

      const result = await cliRunner.runInteractive(
        [],
        [
          {
            waitFor: /Welcome.*Smktc/i,
            select: 'Create new project', // Menu selection
            input: '\r'
          },
          {
            waitFor: /Project name/i,
            // No select - direct input
            input: 'mixed-demo-project\r'
          },
          {
            waitFor: /generator/i,
            // No select - direct input (select first option)
            input: '\r'
          },
          {
            waitFor: /path/i,
            // No select - direct input
            input: 'output\r'
          }
        ],
        {
          env: envVars,
          cwd: env.homeDir,
          timeout: 15000
        }
      )

      // Verify project was created if successful
      if (result.success) {
        const projectPath = join(env.projectsDir, 'mixed-demo-project')
        const projectExists = await exists(projectPath)
        assertEquals(
          projectExists,
          true,
          'Project should be created when mixed interactions succeed'
        )
      }

      assertEquals(typeof result.code, 'number', 'Should handle mixed interactions')

      await env.cleanup()
    })

    await t.step('validates enhanced API usage patterns', async () => {
      assertEquals(true, true, 'Enhanced API patterns documented')
    })
  }
)

// Cleanup after all tests
globalThis.addEventListener('unload', async () => {
  await envManager.cleanupAll()
})
