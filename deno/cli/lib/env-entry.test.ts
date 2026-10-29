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

Deno.test('mod.ts - an unknown SKMTC_ENV in pull is one readable line, exit 1', async () => {
  const { code, stderr } = await runCli(['pull', 'demo', '--json', '--no-input'], {
    SKMTC_ENV: 'prod',
    SKMTC_HUB_TOKEN: 'pat-123'
  })

  assertEquals(code, 1)
  assertStringIncludes(stderr, 'SKMTC_ENV')
  assertEquals(stderr.includes('Uncaught'), false)
})

// --- api publish from GitHub Actions ---------------------------------------------

const toDenoDir = async (): Promise<string> => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ['info', '--json'],
    stdout: 'piped',
    stderr: 'null'
  }).output()
  const info: unknown = JSON.parse(new TextDecoder().decode(output.stdout))
  if (typeof info !== 'object' || info === null || !('denoDir' in info)) {
    throw new Error('deno info --json gave no denoDir')
  }
  return String(info.denoDir)
}

/**
 * Run `api publish` with no token from anywhere: a home folder of its own and
 * every token variable set, an empty value counting as unset (the child
 * inherits the parent's environment, which on CI is a GitHub Actions run).
 */
const runApiPublish = async (variables: Record<string, string>, args: string[] = []) => {
  const home = await Deno.realPath(await Deno.makeTempDir())
  try {
    return await runCli(['api', 'publish', 'openapi.yaml', '--api', '@acme/pets', ...args], {
      // The cache follows the home folder; keep the parent's, or the child
      // downloads every dependency again and logs it to stderr.
      DENO_DIR: await toDenoDir(),
      HOME: home,
      USERPROFILE: home,
      SKMTC_HUB_TOKEN: '',
      SKMTC_ENV: '',
      SKMTC_API_ORIGIN: '',
      GITHUB_ACTIONS: '',
      ACTIONS_ID_TOKEN_REQUEST_URL: '',
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: '',
      ...variables
    })
  } finally {
    await Deno.remove(home, { recursive: true })
  }
}

/** A local stand-in for GitHub's OIDC provider that counts its requests. */
const withOidcProvider = async (
  status: number,
  run: (requestUrl: string, requests: () => number) => Promise<void>
): Promise<void> => {
  let requests = 0
  const server = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen: () => {} }, () => {
    requests++
    return new Response('provider down', { status })
  })
  try {
    await run(`http://127.0.0.1:${server.addr.port}/token?api-version=2.0`, () => requests)
  } finally {
    await server.shutdown()
  }
}

Deno.test('mod.ts - a malformed ACTIONS_ID_TOKEN_REQUEST_URL in api publish is one readable line, exit 1', async () => {
  const { code, stdout, stderr } = await runApiPublish({
    GITHUB_ACTIONS: 'true',
    ACTIONS_ID_TOKEN_REQUEST_URL: 'not-a-url',
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-token'
  })

  assertEquals(code, 1)
  assertEquals(stdout, '')
  assertStringIncludes(stderr, 'ACTIONS_ID_TOKEN_REQUEST_URL')
  assertEquals(stderr.includes('Uncaught'), false)
  assertEquals(stderr.split('\n').length, 1)
})

Deno.test('mod.ts - api publish in GitHub Actions without id-token: write exits 2 and names it', async () => {
  const { code, stdout, stderr } = await runApiPublish({ GITHUB_ACTIONS: 'true' })

  assertEquals(code, 2)
  assertEquals(stdout, '')
  assertStringIncludes(stderr, '`permissions: id-token: write`')
})

Deno.test('mod.ts - api publish outside GitHub Actions ignores the OIDC variables', async () => {
  await withOidcProvider(200, async (requestUrl, requests) => {
    const { code, stderr } = await runApiPublish({
      ACTIONS_ID_TOKEN_REQUEST_URL: requestUrl,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-token'
    })

    assertEquals(code, 2)
    assertStringIncludes(stderr, 'Run `skmtc login`, set $SKMTC_HUB_TOKEN, or pass --token.')
    assertEquals(stderr.includes('id-token'), false)
    assertEquals(requests(), 0)
  })
})

Deno.test('mod.ts - api publish with a failing OIDC provider exits 1 with code oidc-token', async () => {
  await withOidcProvider(500, async (requestUrl, requests) => {
    const { code, stdout, stderr } = await runApiPublish(
      {
        GITHUB_ACTIONS: 'true',
        ACTIONS_ID_TOKEN_REQUEST_URL: requestUrl,
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-token-secret'
      },
      ['--json']
    )

    assertEquals(code, 1)
    assertEquals(requests(), 1)
    assertEquals(JSON.parse(stdout), {
      type: 'failed',
      code: 'oidc-token',
      message: "GitHub's OIDC provider answered 500: provider down"
    })
    assertEquals(`${stdout}${stderr}`.includes('request-token-secret'), false)
  })
})
