import { assertEquals } from '@std/assert/equals'
import { assertRejects } from '@std/assert/rejects'
import { join } from '@std/path/join'
import { withEnv } from '@/tests/mocks/env.mock.ts'
import { NoServerForCoreError, pinServerForPublish } from '@/lib/publish-server-pin.ts'

/** Published `@skmtc/server` versions and the core range each one imports. */
type ServerRelease = { core: string; yanked?: boolean }

const servers: Record<string, ServerRelease> = {
  '0.3.32': { core: '^0.44.0' },
  '0.3.33': { core: '^0.44.1' },
  '0.3.34': { core: '^0.44.2' },
  // Newer than the CLI's pin: never chosen.
  '0.3.35': { core: '^0.44.1' }
}

/** The CLI's own server pin in these tests. */
const cliVersion = '0.3.34'

/** Serves `releases` as JSR's `meta.json` and `<version>/deno.json`, with `JSR_URL` pointed at it. */
const withRegistry = async (releases: Record<string, ServerRelease>, fn: () => Promise<void>) => {
  const requests: string[] = []
  const server = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen: () => {} }, request => {
    const { pathname } = new URL(request.url)
    requests.push(pathname)

    if (pathname === '/@skmtc/server/meta.json') {
      const names = Object.keys(releases)
      return Response.json({
        scope: 'skmtc',
        name: 'server',
        latest: names.at(-1),
        versions: Object.fromEntries(
          names.map(v => [v, releases[v].yanked ? { yanked: true } : {}])
        )
      })
    }

    const release = pathname.match(/^\/@skmtc\/server\/([^/]+)\/deno\.json$/)
    const found = release === null ? undefined : releases[release[1]]

    return found === undefined
      ? new Response('not found', { status: 404 })
      : Response.json({
          name: '@skmtc/server',
          version: release?.[1],
          imports: { '@skmtc/core': `jsr:@skmtc/core@${found.core}` }
        })
  })

  try {
    await withEnv({ JSR_URL: `http://127.0.0.1:${server.addr.port}/` }, fn)
  } finally {
    await server.shutdown()
  }

  return requests
}

const withProject = async (
  imports: Record<string, string>,
  run: (projectPath: string) => Promise<void>
): Promise<void> => {
  const projectPath = await Deno.makeTempDir()
  await Deno.writeTextFile(
    join(projectPath, 'deno.json'),
    JSON.stringify({ name: '@acme/my-api', version: '1.0.0', imports })
  )
  try {
    await run(projectPath)
  } finally {
    await Deno.remove(projectPath, { recursive: true })
  }
}

const readImports = async (projectPath: string): Promise<unknown> =>
  JSON.parse(await Deno.readTextFile(join(projectPath, 'deno.json'))).imports

Deno.test(
  'pinServerForPublish - adds the CLI version when its core range accepts the project core',
  async () => {
    await withRegistry(servers, async () => {
      await withProject({ '@skmtc/core': 'jsr:@skmtc/core@0.44.2' }, async projectPath => {
        assertEquals(await pinServerForPublish(projectPath, { cliVersion }), {
          package: '@skmtc/server',
          from: null,
          to: 'jsr:@skmtc/server@0.3.34'
        })
        assertEquals(await readImports(projectPath), {
          '@skmtc/core': 'jsr:@skmtc/core@0.44.2',
          '@skmtc/server': 'jsr:@skmtc/server@0.3.34'
        })
      })
    })
  }
)

Deno.test(
  'pinServerForPublish - picks an older server when the CLI version needs a newer core',
  async () => {
    // skmtc/skmtc-hub#3652: generators on core 0.44.1, CLI server 0.3.34 asks
    // ^0.44.2. Pinning 0.3.34 put two cores in deno.lock and the hub refused it.
    await withRegistry(servers, async () => {
      await withProject(
        { '@skmtc/core': 'jsr:@skmtc/core@0.44.1', '@skmtc/server': 'jsr:@skmtc/server@0.3.34' },
        async projectPath => {
          assertEquals(await pinServerForPublish(projectPath, { cliVersion }), {
            package: '@skmtc/server',
            from: 'jsr:@skmtc/server@0.3.34',
            to: 'jsr:@skmtc/server@0.3.33'
          })
        }
      )
    })
  }
)

Deno.test('pinServerForPublish - skips a yanked version', async () => {
  const releases = { ...servers, '0.3.33': { core: '^0.44.1', yanked: true } }
  await withRegistry(releases, async () => {
    await withProject({ '@skmtc/core': 'jsr:@skmtc/core@0.44.1' }, async projectPath => {
      const change = await pinServerForPublish(projectPath, { cliVersion })
      assertEquals(change?.to, 'jsr:@skmtc/server@0.3.32')
    })
  })
})

Deno.test('pinServerForPublish - leaves a fitting pin and the file alone', async () => {
  await withRegistry(servers, async () => {
    await withProject(
      { '@skmtc/core': 'jsr:@skmtc/core@0.44.2', '@skmtc/server': 'jsr:@skmtc/server@0.3.34' },
      async projectPath => {
        const before = await Deno.readTextFile(join(projectPath, 'deno.json'))
        assertEquals(await pinServerForPublish(projectPath, { cliVersion }), null)
        // No rewrite: the user's formatting survives a no-op deploy.
        assertEquals(await Deno.readTextFile(join(projectPath, 'deno.json')), before)
      }
    )
  })
})

Deno.test(
  'pinServerForPublish - no server accepts the project core: stops and changes nothing',
  async () => {
    await withRegistry(servers, async () => {
      await withProject({ '@skmtc/core': 'jsr:@skmtc/core@0.43.0' }, async projectPath => {
        const before = await Deno.readTextFile(join(projectPath, 'deno.json'))
        const error = await assertRejects(
          () => pinServerForPublish(projectPath, { cliVersion }),
          NoServerForCoreError
        )
        assertEquals(
          error.message,
          "No published @skmtc/server accepts the project's @skmtc/core 0.43.0 (tried 3 versions, 0.3.34 down to 0.3.32). " +
            "Move the project's generators to a core that a server accepts, or update the CLI."
        )
        assertEquals(await Deno.readTextFile(join(projectPath, 'deno.json')), before)
      })
    })
  }
)

Deno.test(
  'pinServerForPublish - without an exact core pin, pins the CLI version and reads no registry',
  async () => {
    const requests = await withRegistry(servers, async () => {
      await withProject({ '@skmtc/server': 'jsr:@skmtc/server@0.0.1' }, async projectPath => {
        const change = await pinServerForPublish(projectPath, { cliVersion })
        assertEquals(change?.to, 'jsr:@skmtc/server@0.3.34')
      })
    })
    assertEquals(requests, [])
  }
)

Deno.test('pinServerForPublish - keeps a local override of @skmtc/server', async () => {
  await withRegistry(servers, async () => {
    await withProject(
      { '@skmtc/core': 'jsr:@skmtc/core@0.44.1', '@skmtc/server': '../server/mod.ts' },
      async projectPath => {
        assertEquals(await pinServerForPublish(projectPath, { cliVersion }), null)
        assertEquals(await readImports(projectPath), {
          '@skmtc/core': 'jsr:@skmtc/core@0.44.1',
          '@skmtc/server': '../server/mod.ts'
        })
      }
    )
  })
})
