import { assertEquals, assertStringIncludes } from '@std/assert'
import { apiLinkHeadless } from '@/lib/api-link-headless.ts'
import {
  type ApiLinkResult,
  printApiLinkResult,
  renderApiLink,
  runApiLink
} from '@/commands/api.ts'
import { withEnv } from '@/tests/mocks/env.mock.ts'
import { withCapturedExit } from '@/tests/mocks/exit.mock.ts'
import {
  makeLinkRepo,
  PUBLISH_ACTION_WORKFLOW,
  PUBLISH_CLI_WORKFLOW,
  TEST_WORKFLOW,
  UNSET_GIT_VARIABLES
} from '@/tests/mocks/link-repo.mock.ts'
import {
  withNeverAnsweringFetch,
  withStallingBodyFetch
} from '@/tests/mocks/never-answering-fetch.mock.ts'

const originalFetch = globalThis.fetch
const originalCwd = Deno.cwd()

type Call = { url: string; method?: string; authorization?: string; body?: unknown }

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const PAGE = 'https://skmtc.dev/acme/apis/pets/settings?linkRequest=req_1'

/** The hub's `CreatedLinkedRepositoryRequest`. */
const created = (url = PAGE): unknown => ({
  id: 'req_1',
  url,
  expiresAt: '2026-10-30T12:15:00.000Z'
})

const BASE = {
  api: { account: 'acme', slug: 'pets' },
  repository: 'acme/pets',
  workflow: '.github/workflows/publish.yml',
  token: 'pat-123',
  origin: 'https://api.skmtc.dev',
  env: 'production' as const
}

const withFetch = async (
  fetchStub: (call: Call) => Response | Promise<Response>,
  run: () => Promise<void>
): Promise<void> => {
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) =>
    fetchStub({
      url: input.toString(),
      method: init?.method,
      authorization: new Headers(init?.headers).get('authorization') ?? undefined,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    })
  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

// --- the request ------------------------------------------------------------

Deno.test('apiLinkHeadless - posts provider, repository, workflowPath and environment with the bearer token', async () => {
  const calls: Call[] = []
  await withFetch(
    call => {
      calls.push(call)
      return json(created(), 201)
    },
    async () => {
      const result = await apiLinkHeadless({ ...BASE, environment: 'Production' })

      assertEquals(calls, [
        {
          url: 'https://api.skmtc.dev/v1/apis/acme/pets/linked-repository-requests',
          method: 'POST',
          authorization: 'Bearer pat-123',
          body: {
            provider: 'github',
            repository: 'acme/pets',
            workflowPath: '.github/workflows/publish.yml',
            environment: 'Production'
          }
        }
      ])
      assertEquals(result, {
        type: 'requested',
        id: 'req_1',
        url: PAGE,
        expiresAt: '2026-10-30T12:15:00.000Z'
      })
    }
  )
})

Deno.test('apiLinkHeadless - without --environment the body has no environment', async () => {
  const calls: Call[] = []
  await withFetch(
    call => {
      calls.push(call)
      return json(created(), 201)
    },
    async () => {
      await apiLinkHeadless(BASE)
      assertEquals(calls[0].body, {
        provider: 'github',
        repository: 'acme/pets',
        workflowPath: '.github/workflows/publish.yml'
      })
    }
  )
})

Deno.test('apiLinkHeadless - a 201 without id, url or expiresAt is hub-error', async () => {
  await withFetch(
    () => json({ id: 'req_1' }, 201),
    async () => {
      const result = await apiLinkHeadless(BASE)
      assertEquals(result.type === 'failed' ? result.code : result.type, 'hub-error')
    }
  )
})

Deno.test('apiLinkHeadless - 400 gives the hub message and its details', async () => {
  await withFetch(
    () =>
      json(
        {
          message: 'Invalid link request',
          requestId: 'rq-9',
          details: [{ field: 'workflowPath', message: 'must be in .github/workflows/' }]
        },
        400
      ),
    async () => {
      assertEquals(await apiLinkHeadless(BASE), {
        type: 'failed',
        code: 'bad-request',
        status: 400,
        message: 'Invalid link request',
        requestId: 'rq-9',
        details: [{ field: 'workflowPath', message: 'must be in .github/workflows/' }]
      })
    }
  )
})

const statusCases: { status: number; code: string; message: string }[] = [
  {
    status: 401,
    code: 'unauthorized',
    message: 'Invalid token. Sign in again with `skmtc login`, or pass a valid --token.'
  },
  {
    status: 403,
    code: 'forbidden',
    message:
      'You are not an admin of @acme/pets. Run `skmtc login` as an admin, or pass a --token for an admin.'
  },
  {
    status: 404,
    code: 'not-found',
    message: 'API @acme/pets not found, or you cannot see it.'
  },
  {
    status: 429,
    code: 'rate-limited',
    message:
      '10 link requests are open on this API; wait 15 minutes or decline one on the settings page.'
  },
  { status: 503, code: 'hub-error', message: 'Invalid token' }
]

for (const { status, code, message } of statusCases) {
  Deno.test(`apiLinkHeadless - ${status} is ${code} with its message`, async () => {
    await withFetch(
      () => json({ message: 'Invalid token' }, status),
      async () => {
        const result = await apiLinkHeadless(BASE)
        assertEquals(result.type === 'failed' ? [result.code, result.status] : [], [code, status])
        assertEquals(result.type === 'failed' ? result.message : undefined, message)
      }
    )
  })
}

Deno.test('apiLinkHeadless - a hub that never answers is network, within the timeout', async () => {
  await withNeverAnsweringFetch(async () => {
    const result = await apiLinkHeadless({ ...BASE, timeoutMs: 10 })
    assertEquals(result.type === 'failed' ? result.code : result.type, 'network')
  })
})

Deno.test('apiLinkHeadless - a 201 whose body stalls is network, not a malformed answer', async () => {
  await withStallingBodyFetch(201, async () => {
    const result = await apiLinkHeadless({ ...BASE, timeoutMs: 10 })
    assertEquals(result.type === 'failed' ? result.code : result.type, 'network')
  })
})

Deno.test('apiLinkHeadless - a 403 whose body stalls is network', async () => {
  await withStallingBodyFetch(403, async () => {
    const result = await apiLinkHeadless({ ...BASE, timeoutMs: 10 })
    assertEquals(result.type === 'failed' ? result.code : result.type, 'network')
  })
})

// --- the command ------------------------------------------------------------

/**
 * The environment of a developer's terminal: no CI variables, no ambient
 * token and an empty home folder, so no stored login.
 */
const withTerminal = async (
  variables: Record<string, string | undefined>,
  run: () => Promise<void>
): Promise<void> => {
  const home = await Deno.makeTempDir()
  try {
    await withEnv(
      {
        HOME: home,
        USERPROFILE: home,
        SKMTC_HUB_TOKEN: undefined,
        SKMTC_ENV: undefined,
        SKMTC_API_ORIGIN: undefined,
        GITHUB_ACTIONS: undefined,
        CI: undefined,
        ...UNSET_GIT_VARIABLES,
        ...variables
      },
      run
    )
  } finally {
    await Deno.remove(home, { recursive: true })
  }
}

/** A repository with one publish workflow, used as the cwd. */
const withLinkRepo = async (
  options: Parameters<typeof makeLinkRepo>[0],
  run: (root: string) => Promise<void>
): Promise<void> => {
  const root = await makeLinkRepo(options)
  Deno.chdir(root)
  try {
    await run(root)
  } finally {
    Deno.chdir(originalCwd)
    await Deno.remove(root, { recursive: true })
  }
}

const ONE_WORKFLOW = {
  remote: 'git@github.com:acme/pets.git',
  workflows: { 'publish.yml': PUBLISH_ACTION_WORKFLOW, 'test.yml': TEST_WORKFLOW }
}

const RUN_BASE = {
  api: { account: 'acme', slug: 'pets' },
  repoFlag: undefined,
  workflowFlag: undefined,
  environment: undefined,
  openFlag: true,
  tokenFlag: 'pat-123',
  envFlag: undefined
}

/** An opener that records each URL it is given. */
const toRecordingOpener = () => {
  const opened: string[] = []
  return {
    opened,
    open: (url: string) => {
      opened.push(url)
      return Promise.resolve(true)
    }
  }
}

Deno.test('runApiLink - in a repo with one publish workflow, requests the right values and opens the page once', async () => {
  const calls: Call[] = []
  const opener = toRecordingOpener()
  await withTerminal({}, () =>
    withLinkRepo(ONE_WORKFLOW, () =>
      withFetch(
        call => {
          calls.push(call)
          return json(created(), 201)
        },
        async () => {
          const result = await runApiLink({
            ...RUN_BASE,
            environment: 'production',
            open: opener.open
          })

          assertEquals(
            calls.map(call => [call.url, call.body]),
            [
              [
                'https://api.skmtc.dev/v1/apis/acme/pets/linked-repository-requests',
                {
                  provider: 'github',
                  repository: 'acme/pets',
                  workflowPath: '.github/workflows/publish.yml',
                  environment: 'production'
                }
              ]
            ]
          )
          assertEquals(opener.opened, [PAGE])
          assertEquals(result, {
            type: 'requested',
            api: { account: 'acme', slug: 'pets' },
            repository: 'acme/pets',
            workflow: '.github/workflows/publish.yml',
            environment: 'production',
            id: 'req_1',
            url: PAGE,
            expiresAt: '2026-10-30T12:15:00.000Z',
            origin: 'https://api.skmtc.dev',
            opened: true
          })
        }
      )
    )
  )
})

for (const [label, variables, openFlag] of [
  ['--no-open', {}, false],
  ['GITHUB_ACTIONS=true', { GITHUB_ACTIONS: 'true' }, true],
  ['CI=true', { CI: 'true' }, true]
] as const) {
  Deno.test(`runApiLink - with ${label} the opener is not run`, async () => {
    const opener = toRecordingOpener()
    await withTerminal(variables, () =>
      withLinkRepo(ONE_WORKFLOW, () =>
        withFetch(
          () => json(created(), 201),
          async () => {
            const result = await runApiLink({ ...RUN_BASE, openFlag, open: opener.open })
            assertEquals(opener.opened, [])
            assertEquals(result.type === 'requested' ? result.opened : result.type, false)
          }
        )
      )
    )
  })
}

Deno.test('runApiLink - a page off the environment site is not opened', async () => {
  const opener = toRecordingOpener()
  await withTerminal({}, () =>
    withLinkRepo(ONE_WORKFLOW, () =>
      withFetch(
        () => json(created('https://skmtc.dev.evil.test/acme/apis/pets/settings'), 201),
        async () => {
          const result = await runApiLink({ ...RUN_BASE, open: opener.open })
          assertEquals(opener.opened, [])
          assertEquals(result.type === 'requested' ? result.opened : result.type, false)
        }
      )
    )
  )
})

Deno.test('runApiLink - no stored login is missing, names skmtc login and sends no request', async () => {
  for (const variables of [{}, { GITHUB_ACTIONS: 'true' }]) {
    const calls: Call[] = []
    await withTerminal(variables, () =>
      withLinkRepo(ONE_WORKFLOW, () =>
        withFetch(
          call => {
            calls.push(call)
            return json(created(), 201)
          },
          async () => {
            const result = await runApiLink({ ...RUN_BASE, tokenFlag: undefined })
            assertEquals(result.type, 'missing')
            if (result.type === 'missing') assertStringIncludes(result.discover, '`skmtc login`')
          }
        )
      )
    )
    assertEquals(calls, [])
  }
})

Deno.test('runApiLink - a --workflow outside .github/workflows/ is invalid and sends no request', async () => {
  const calls: Call[] = []
  await withTerminal({}, () =>
    withLinkRepo(ONE_WORKFLOW, () =>
      withFetch(
        call => {
          calls.push(call)
          return json(created(), 201)
        },
        async () => {
          const result = await runApiLink({ ...RUN_BASE, workflowFlag: 'ci/publish.yml' })
          assertEquals(result.type, 'invalid')
        }
      )
    )
  )
  assertEquals(calls, [])
})

// --- exit codes and output ----------------------------------------------------

const RENDER_BASE = {
  api: '@acme/pets',
  repo: undefined,
  workflow: undefined,
  environment: undefined,
  open: false,
  token: 'pat-123',
  env: undefined,
  jsonFlag: true
}

for (const { status, message } of statusCases.filter(({ status }) => status !== 503)) {
  Deno.test(`renderApiLink - ${status} prints its message and exits 1`, async () => {
    await withTerminal({}, () =>
      withLinkRepo(ONE_WORKFLOW, () =>
        withFetch(
          () => json({ message: 'Invalid token' }, status),
          async () => {
            const run = await withCapturedExit(() => renderApiLink(RENDER_BASE))
            assertEquals(run.exitCode, 1)
            assertEquals(JSON.parse(run.stdout).message, message)
          }
        )
      )
    )
  })
}

Deno.test('renderApiLink - success exits 0 with the requested JSON', async () => {
  await withTerminal({}, () =>
    withLinkRepo(ONE_WORKFLOW, () =>
      withFetch(
        () => json(created(), 201),
        async () => {
          const run = await withCapturedExit(() => renderApiLink(RENDER_BASE))
          assertEquals(run.exitCode, 0)
          assertEquals(JSON.parse(run.stdout), {
            type: 'requested',
            api: { account: 'acme', slug: 'pets' },
            repository: 'acme/pets',
            workflow: '.github/workflows/publish.yml',
            environment: null,
            id: 'req_1',
            url: PAGE,
            expiresAt: '2026-10-30T12:15:00.000Z',
            origin: 'https://api.skmtc.dev',
            opened: false
          })
        }
      )
    )
  )
})

const usageCases: { label: string; options: Parameters<typeof makeLinkRepo>[0]; flag: string }[] = [
  { label: 'no remote', options: { workflows: ONE_WORKFLOW.workflows }, flag: '--repo' },
  {
    label: 'a non-GitHub remote',
    options: { remote: 'https://gitlab.com/acme/pets.git', workflows: ONE_WORKFLOW.workflows },
    flag: '--repo'
  },
  {
    label: 'two publish workflows',
    options: {
      remote: ONE_WORKFLOW.remote,
      workflows: { 'a.yml': PUBLISH_ACTION_WORKFLOW, 'b.yml': PUBLISH_CLI_WORKFLOW }
    },
    flag: '--workflow'
  },
  { label: 'no publish workflow', options: { remote: ONE_WORKFLOW.remote }, flag: '--workflow' }
]

for (const { label, options, flag } of usageCases) {
  Deno.test(`renderApiLink - ${label} exits 2, names ${flag} and sends no request`, async () => {
    const calls: Call[] = []
    await withTerminal({}, () =>
      withLinkRepo(options, () =>
        withFetch(
          call => {
            calls.push(call)
            return json(created(), 201)
          },
          async () => {
            const run = await withCapturedExit(() => renderApiLink(RENDER_BASE))
            assertEquals(run.exitCode, 2)
            assertStringIncludes(run.stderr, flag)
          }
        )
      )
    )
    assertEquals(calls, [])
  })
}

Deno.test('printApiLinkResult - --json prints the failure shape of api publish', async () => {
  const failed: ApiLinkResult = {
    type: 'failed',
    code: 'bad-request',
    status: 400,
    message: 'Invalid link request',
    requestId: 'rq-9',
    details: [{ field: 'workflowPath', message: 'bad' }]
  }
  const run = await withCapturedExit(() => {
    printApiLinkResult(failed, { format: 'json' })
    return Promise.resolve()
  })
  assertEquals(JSON.parse(run.stdout), failed)
})

Deno.test('printApiLinkResult - text names the values, the page, the expiry and Link repository', async () => {
  const run = await withCapturedExit(() => {
    printApiLinkResult(
      {
        type: 'requested',
        api: { account: 'acme', slug: 'pets' },
        repository: 'acme/pets',
        workflow: '.github/workflows/publish.yml',
        environment: null,
        id: 'req_1',
        url: PAGE,
        expiresAt: '2026-10-30T12:15:00.000Z',
        origin: 'https://api.skmtc.dev',
        opened: true
      },
      { format: 'text' }
    )
    return Promise.resolve()
  })
  for (const text of [
    'acme/pets',
    '.github/workflows/publish.yml',
    'environment: any',
    PAGE,
    '2026-10-30T12:15:00.000Z',
    'Link repository'
  ]) {
    assertStringIncludes(run.stdout, text)
  }
})
