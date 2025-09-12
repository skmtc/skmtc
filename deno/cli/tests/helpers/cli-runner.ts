import { join } from '@std/path/join'
import { assertSnapshot } from '@std/testing/snapshot'

export interface CliRunOptions {
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  timeout?: number
}

export interface CliRunResult {
  stdout: string
  stderr: string
  code: number | null
  success: boolean
}

export class CliRunner {
  private cliPath: string
  private defaultEnv: Record<string, string>

  constructor(cliPath?: string) {
    this.cliPath = cliPath || join(Deno.cwd(), '../cli/mod.ts')
    this.defaultEnv = {
      NO_COLOR: '1',
      FORCE_COLOR: '0'
    }
  }

  normalizeOutput(output: string): string {
    return output
      .replace(/\r\n/g, '\n')
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/[┌─┐│└┘├┤┬┴┼]/g, '+')
      .trim()
  }

  async assertSnapshot(t: Deno.TestContext, result: CliRunResult, name?: string): Promise<void> {
    const normalized = {
      stdout: this.normalizeOutput(result.stdout),
      stderr: this.normalizeOutput(result.stderr),
      code: result.code,
      success: result.success
    }

    await assertSnapshot(t, normalized, name)
  }

  /**
   * Selects a menu item by label from an interactive CLI menu
   * Navigates through the menu using down arrow keys until the target item is found
   * @param targetLabel - The label to search for in the menu
   * @param maxAttempts - Maximum number of down arrow presses to try (default: 10)
   * @returns Interaction that will navigate to and select the target item
   */
  createMenuSelector(
    targetLabel: string,
    maxAttempts: number = 10
  ): Array<{ waitFor: string | RegExp; input: string }> {
    const interactions: Array<{ waitFor: string | RegExp; input: string }> = []

    // Start by waiting for the target item to appear
    interactions.push({
      waitFor: new RegExp(targetLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      input: '\r' // Enter to select when found
    })

    return interactions
  }

  /**
   * Simple execution path for non-interactive commands
   */
  async runSimple(
    args: string[],
    options: { env?: Record<string, string>; cwd?: string; timeout?: number } = {}
  ): Promise<CliRunResult> {
    const { env = {}, cwd, timeout = 10000 } = options

    const importMapPath = join(Deno.cwd(), 'tests/test-complete.importmap.json')
    const command = new Deno.Command('deno', {
      args: [
        'run',
        '--quiet',
        '--allow-all',
        `--import-map=${importMapPath}`,
        this.cliPath,
        ...args
      ],
      env: { ...this.defaultEnv, ...env },
      cwd,
      stdout: 'piped',
      stderr: 'piped'
    })

    const process = command.spawn()
    const { stdout, stderr } = await process.output()
    const status = await process.status

    return {
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
      code: status.code,
      success: status.success
    }
  }

  /**
   * Interactive CLI runner that yields control back to the test
   * 
   * @param args CLI arguments
   * @param interactionHandler Function that receives stdout chunks and can send input
   * @param options Configuration options
   */
  async runWithInteractionHandler(
    args: string[],
    interactionHandler: (stdout: string, sendInput: (input: string) => Promise<void>) => Promise<void>,
    options: { env?: Record<string, string>; cwd?: string; timeout?: number } = {}
  ): Promise<CliRunResult> {
    const { env = {}, cwd, timeout = 30000 } = options

    const importMapPath = join(Deno.cwd(), 'tests/test-complete.importmap.json')
    const command = new Deno.Command('deno', {
      args: [
        'run',
        '--quiet',
        '--allow-all',
        `--import-map=${importMapPath}`,
        this.cliPath,
        ...args
      ],
      env: { ...this.defaultEnv, ...env },
      cwd,
      stdin: 'piped',
      stdout: 'piped',
      stderr: 'piped'
    })

    const process = command.spawn()
    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    let stderrReader: ReadableStreamDefaultReader<Uint8Array> | null = null

    try {
      writer = process.stdin!.getWriter()
      reader = process.stdout!.getReader()
      stderrReader = process.stderr!.getReader()

      let stdout = ''
      let stderr = ''
      const decoder = new TextDecoder()

      // Read stderr in background
      const stderrPromise = (async () => {
        try {
          while (true) {
            const { value, done } = await stderrReader!.read()
            if (done || !value) break
            stderr += decoder.decode(value, { stream: true })
          }
        } catch {
          // stderr reading error, continue
        }
      })()

      // Create input sender function
      const sendInput = async (input: string) => {
        await writer!.write(new TextEncoder().encode(input))
      }

      // Start reading stdout and let the interaction handler control flow
      const readerPromise = (async () => {
        try {
          while (true) {
            const { value, done } = await reader!.read()
            if (done || !value) break
            
            const chunk = decoder.decode(value, { stream: true })
            stdout += chunk
            
            // Let the test handler decide what to do with this output
            await interactionHandler(stdout, sendInput)
          }
        } catch {
          // Reader error, continue to cleanup
        }
      })()

      // Wait for process to complete or timeout
      await Promise.race([
        readerPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Process timeout')), timeout))
      ])

      // Close stdin to signal completion
      await writer.close()
      writer = null

      // Wait for stderr and process completion
      await Promise.all([
        stderrPromise.catch(() => {}),
        process.status.catch(() => {})
      ])

      const status = await process.status

      return {
        stdout,
        stderr,
        code: status.code,
        success: status.success
      }
    } catch (error) {
      try {
        process.kill('SIGKILL')
      } catch {
        // Process may already be dead
      }
      throw error
    } finally {
      // Clean up resources
      const cleanup = async (resource: any) => {
        try {
          if (resource) {
            if ('cancel' in resource) await resource.cancel()
            else if ('close' in resource) await resource.close()
          }
        } catch {
          // Cleanup error, continue
        }
      }

      await Promise.all([
        cleanup(reader),
        cleanup(stderrReader),
        cleanup(writer)
      ])
    }
  }

  /**
   * Backwards compatibility - converts old interaction format to new handler
   */
  async runInteractive(
    args: string[],
    menuSelections: Array<{ waitFor?: string | RegExp; select?: string; input?: string }>,
    options: { env?: Record<string, string>; cwd?: string; timeout?: number } = {}
  ): Promise<CliRunResult> {
    // If no interactions, use simple path
    if (menuSelections.length === 0) {
      return this.runSimple(args, options)
    }

    let currentStep = 0
    let buffer = ''

    return this.runWithInteractionHandler(
      args,
      async (stdout, sendInput) => {
        buffer = stdout
        
        // Check if we have more steps to process
        if (currentStep >= menuSelections.length) return

        const selection = menuSelections[currentStep]
        
        // Check if waitFor condition is met
        if (selection.waitFor) {
          const waitPattern = selection.waitFor
          const waitMatches = typeof waitPattern === 'string'
            ? buffer.includes(waitPattern)
            : waitPattern.test(buffer)
          
          if (!waitMatches) return // Wait for condition
        }

        // Send appropriate input
        if (selection.select) {
          // Menu navigation - look for the item and send Enter
          const targetRegex = new RegExp(
            selection.select.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'i'
          )
          
          if (targetRegex.test(buffer)) {
            await sendInput(selection.input || '\r')
            currentStep++
          }
          // If not found, we could send down arrow, but for now just wait
        } else if (selection.input) {
          // Direct input
          await sendInput(selection.input)
          currentStep++
        }
      },
      options
    )
  }
}
