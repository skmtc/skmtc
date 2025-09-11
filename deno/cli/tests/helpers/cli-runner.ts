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
      FORCE_COLOR: '0',
    }
  }

  async run(options: CliRunOptions = {}): Promise<CliRunResult> {
    const { args = [], stdin, env = {}, cwd, timeout = 10000 } = options

    const importMapPath = join(Deno.cwd(), 'tests/test-complete.importmap.json')
    const command = new Deno.Command('deno', {
      args: ['run', '--allow-all', `--import-map=${importMapPath}`, this.cliPath, ...args],
      env: { ...this.defaultEnv, ...env },
      cwd,
      stdin: stdin ? 'piped' : 'null',
      stdout: 'piped',
      stderr: 'piped',
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
      success: output.success,
    }
  }

  async runInteractive(
    args: string[],
    interactions: Array<{ waitFor: string | RegExp; input: string }>,
    options: { env?: Record<string, string>; cwd?: string } = {}
  ): Promise<CliRunResult> {
    const { env = {}, cwd } = options
    
    const command = new Deno.Command('deno', {
      args: ['run', '--allow-all', '--import-map=tests/test.importmap.json', this.cliPath, ...args],
      env: { ...this.defaultEnv, ...env },
      cwd,
      stdin: 'piped',
      stdout: 'piped',
      stderr: 'piped',
    })

    const process = command.spawn()
    const writer = process.stdin!.getWriter()
    const reader = process.stdout!.getReader()

    let stdout = ''
    let stderr = ''
    const decoder = new TextDecoder()

    try {
      for (let i = 0; i < interactions.length; i++) {
        const interaction = interactions[i]
        let buffer = ''
        
        console.log(`\n--- Step ${i + 1}: Waiting for "${interaction.waitFor}" ---`)
        
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          stdout += chunk
          buffer += chunk

          const pattern = typeof interaction.waitFor === 'string' 
            ? interaction.waitFor 
            : interaction.waitFor

          const matches = typeof pattern === 'string' 
            ? buffer.includes(pattern)
            : pattern.test(buffer)

          if (matches) {
            console.log('Current screen state:')
            console.log(buffer.slice(-500)) // Show last 500 chars of current screen
            console.log(`\n>>> Sending input: ${JSON.stringify(interaction.input)} <<<\n`)
            
            await writer.write(new TextEncoder().encode(interaction.input))
            
            // Give a moment for the UI to update
            await new Promise(resolve => setTimeout(resolve, 100))
            break
          }
        }
      }

      await writer.close()
      const output = await process.output()
      
      const remainingStdout = decoder.decode(output.stdout)
      const remainingStderr = decoder.decode(output.stderr)
      
      stdout += remainingStdout
      stderr += remainingStderr

      return {
        stdout,
        stderr,
        code: output.code,
        success: output.success,
      }
    } catch (error) {
      process.kill()
      throw error
    }
  }

  normalizeOutput(output: string): string {
    return output
      .replace(/\r\n/g, '\n')
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/[┌─┐│└┘├┤┬┴┼]/g, '+')
      .trim()
  }

  async assertSnapshot(
    t: Deno.TestContext,
    result: CliRunResult,
    name?: string
  ): Promise<void> {
    const normalized = {
      stdout: this.normalizeOutput(result.stdout),
      stderr: this.normalizeOutput(result.stderr),
      code: result.code,
      success: result.success,
    }
    
    await assertSnapshot(t, normalized, name)
  }
}