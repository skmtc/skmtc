import { assertEquals, assertStringIncludes } from '@std/assert'
import { fromFileUrl } from '@std/path/from-file-url'

const cliDirectory = fromFileUrl(new URL('..', import.meta.url))

const runCli = async (args: string[], env: Record<string, string>) => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ['run', '--allow-all', 'mod.ts', ...args],
    cwd: cliDirectory,
    env,
    stdout: 'piped',
    stderr: 'piped'
  }).output()

  return {
    code: output.code,
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr).trim()
  }
}

Deno.test('mod.ts - a malformed JSR_URL in agent-context is one readable line, exit 1', async () => {
  const { code, stdout, stderr } = await runCli(['agent-context', '--json'], {
    JSR_URL: 'not-a-url'
  })

  assertEquals(code, 1)
  assertEquals(stdout, '')
  assertStringIncludes(stderr, 'JSR_URL')
  assertEquals(stderr.includes('Uncaught'), false)
  assertEquals(stderr.split('\n').length, 1)
})

Deno.test('mod.ts - a malformed SKMTC_API_ORIGIN in pull is one readable line, exit 1', async () => {
  const { code, stderr } = await runCli(['pull', 'demo', '--json', '--no-input'], {
    SKMTC_API_ORIGIN: 'not-a-url',
    SKMTC_HUB_TOKEN: 'pat-123'
  })

  assertEquals(code, 1)
  assertStringIncludes(stderr, 'SKMTC_API_ORIGIN')
  assertEquals(stderr.includes('Uncaught'), false)
})
