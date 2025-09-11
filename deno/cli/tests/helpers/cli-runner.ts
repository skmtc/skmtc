import { join } from '@std/path/join'
import { assertSnapshot } from '@std/testing/snapshot'

export interface CliRunOptions {
  args?: string[]
  stdin?: string
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
    this.cliPath = cliPath || join(Deno.cwd(), 'mod.ts')
    this.defaultEnv = {
      NO_COLOR: '1',
      FORCE_COLOR: '0'
    }
  }

  async run(options: CliRunOptions = {}): Promise<CliRunResult> {
    const { args = [], stdin, env = {}, cwd, timeout = 10000 } = options

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
      stdin: stdin ? 'piped' : 'null',
      stdout: 'piped',
      stderr: 'piped'
    })

    const process = command.spawn()

    if (stdin && process.stdin) {
      const writer = process.stdin.getWriter()
      await writer.write(new TextEncoder().encode(stdin))
      await writer.close()
    }

    const timeoutId = setTimeout(() => {
      try {
        process.kill()
      } catch {
        // Process may have already exited
      }
    }, timeout)

    const output = await process.output()
    clearTimeout(timeoutId)

    const stdout = new TextDecoder().decode(output.stdout)
    const stderr = new TextDecoder().decode(output.stderr)

    return {
      stdout,
      stderr,
      code: output.code,
      success: output.success
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
   * Advanced interactive CLI testing with menu navigation and direct input support
   *
   * @param args CLI arguments to pass
   * @param menuSelections Array of interaction steps:
   *   - If `select` is provided: Navigate to find and select the menu item by label
   *   - If `select` is not provided: Send `input` directly to stdin after `waitFor`
   * @param options Configuration options (env vars, cwd, timeout)
   *
   * Examples:
   * - Menu selection: { waitFor: /Welcome/i, select: 'Exit', input: '\r' }
   * - Direct input: { waitFor: /Project name/i, input: 'my-project\r' }
   */
  async runInteractive(
    args: string[],
    menuSelections: Array<{ waitFor?: string | RegExp; select?: string; input?: string }>,
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

      // Read stderr in background to prevent blocking
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

      for (let i = 0; i < menuSelections.length; i++) {
        const selection = menuSelections[i]
        let buffer = ''
        let attempts = 0
        const maxAttempts = 15
        let found = false

        // If select is not provided, just send input directly after waitFor condition
        if (!selection.select) {
          // If there's a waitFor condition, wait for that first
          if (selection.waitFor) {
            while (attempts < maxAttempts && !found) {
              const { value, done } = await Promise.race([
                reader.read(),
                new Promise<{ value: undefined; done: true }>((_, reject) =>
                  setTimeout(() => reject(new Error('Read timeout')), 1000)
                ).catch(() => ({ value: undefined, done: true }))
              ])

              if (done || !value) break

              const chunk = decoder.decode(value, { stream: true })
              stdout += chunk
              buffer += chunk

              const waitPattern = selection.waitFor
              const waitMatches =
                typeof waitPattern === 'string'
                  ? buffer.includes(waitPattern)
                  : waitPattern.test(buffer)

              if (waitMatches) {
                found = true
                break
              }
              attempts++
            }
          } else {
            // No waitFor, just send input immediately
            found = true
          }

          if (found && selection.input) {
            await writer.write(new TextEncoder().encode(selection.input))
          }

          // Brief pause before next step
          await new Promise(resolve => setTimeout(resolve, 100))
          continue
        }

        // If there's a waitFor condition, wait for that first
        if (selection.waitFor) {
          while (attempts < maxAttempts && !found) {
            const { value, done } = await Promise.race([
              reader.read(),
              new Promise<{ value: undefined; done: true }>((_, reject) =>
                setTimeout(() => reject(new Error('Read timeout')), 1000)
              ).catch(() => ({ value: undefined, done: true }))
            ])

            if (done || !value) break

            const chunk = decoder.decode(value, { stream: true })
            stdout += chunk
            buffer += chunk

            const waitPattern = selection.waitFor
            const waitMatches =
              typeof waitPattern === 'string'
                ? buffer.includes(waitPattern)
                : waitPattern.test(buffer)

            if (waitMatches) {
              found = true
              break
            }
            attempts++
          }
        }

        // Now navigate to find the target menu item
        buffer = ''
        attempts = 0
        found = false

        while (attempts < maxAttempts && !found) {
          // Read current screen state
          try {
            const { value, done } = await Promise.race([
              reader.read(),
              new Promise<{ value: undefined; done: true }>((_, reject) =>
                setTimeout(() => reject(new Error('Read timeout')), 500)
              ).catch(() => ({ value: undefined, done: true }))
            ])

            if (value && !done) {
              const chunk = decoder.decode(value, { stream: true })
              stdout += chunk
              buffer += chunk
            }
          } catch {
            // Timeout reading, continue
          }

          // Check if target item is visible
          const targetRegex = new RegExp(
            selection.select!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'i'
          )

          if (targetRegex.test(buffer)) {
            found = true
            // Send selection input (Enter by default)
            const inputKey = selection.input || '\r'
            await writer.write(new TextEncoder().encode(inputKey))
            break
          }

          // Try navigating down to find the item
          if (attempts < maxAttempts - 1) {
            await writer.write(new TextEncoder().encode('\x1b[B')) // Down arrow
            await new Promise(resolve => setTimeout(resolve, 200)) // Wait for UI update
          }

          attempts++
        }

        if (!found) {
          // If we couldn't find the item, try to exit gracefully by pressing Escape or Ctrl+C
          try {
            await writer.write(new TextEncoder().encode('\x1b')) // Escape key
            await new Promise(resolve => setTimeout(resolve, 500))
            await writer.write(new TextEncoder().encode('\x03')) // Ctrl+C
          } catch {
            // Ignore errors during cleanup
          }
          break
        }

        // Brief pause between selections
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Give the process a moment to handle the final input before closing writer
      await new Promise(resolve => setTimeout(resolve, 200))

      // Close writer first
      if (writer) {
        await writer.close()
        writer = null
      }

      // Read any remaining output with shorter timeout
      try {
        let readAttempts = 0
        while (readAttempts < 5 && reader) {
          // Limit read attempts
          const { value, done } = await Promise.race([
            reader.read(),
            new Promise<{ value: undefined; done: true }>((_, reject) =>
              setTimeout(() => reject(new Error('Read timeout')), 800)
            ).catch(() => ({ value: undefined, done: true }))
          ])
          if (done || !value) break
          stdout += decoder.decode(value, { stream: true })
          readAttempts++
        }
      } catch {
        // Read timeout, continue to process termination
      }

      // Wait for stderr to complete
      try {
        await Promise.race([
          stderrPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('stderr timeout')), 1000))
        ])
      } catch {
        // stderr timeout, continue
      }

      // Wait for process to exit with timeout
      const status = await Promise.race([
        process.status,
        new Promise<{ code: number; success: boolean }>((_, reject) =>
          setTimeout(() => reject(new Error('Process timeout')), 3000)
        ).catch(() => {
          // Force kill the process if it doesn't exit cleanly
          try {
            process.kill('SIGKILL')
          } catch {
            // Process may already be dead
          }
          return { code: 143, success: false }
        })
      ])

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
      // Clean up all resources
      const cleanup = async (resource: any, name: string) => {
        try {
          if (resource) {
            if ('cancel' in resource) await resource.cancel()
            else if ('close' in resource) await resource.close()
          }
        } catch {
          // Resource cleanup error, continue
        }
      }

      await Promise.all([
        cleanup(reader, 'reader'),
        cleanup(stderrReader, 'stderrReader'),
        cleanup(writer, 'writer')
      ])
    }
  }
}
