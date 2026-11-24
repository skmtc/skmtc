import { assertEquals } from '@std/assert/equals'
import { assertRejects } from '@std/assert/rejects'
import { assertStringIncludes } from '@std/assert/string-includes'
import { stub } from '@std/testing/mock'
import { join } from '@std/path/join'
import { withEnv } from '@/tests/mocks/env.mock.ts'
import { NoServerForCoreError, pinServerForPublish } from '@/lib/publish-server-pin.ts'

/** Published `@skmtc/server` versions and the core range each one imports. */
type ServerRelease = { core: string; yanked?: boolean; /** Its deno.json answers 500. */ broken?: boolean }

const servers: Record<string, ServerRelease> = {
  '0.3.32': { core: '^0.44.0' },
  '0.3.33': { core: '^0.44.1' },
  '0.3.34': { core: '^0.44.2' },
  // Newer than the CLI's pin: never chosen.
  '0.3.35': { core: '^0.44.1' }
}

/** The CLI's own server pin in these tests. */
const cliVersion = '0.3.34'

/**
 * Serves `releases` as JSR's `meta.json` and `<version>/deno.json`, with
 * `JSR_URL` pointed at it. `down` answers every request with a 500, and
 * `listingDown` only the `meta.json` listing.
 */
const withRegistry = async (
  releases: Record<string, ServerRelease>,
  fn: () => Promise<void>,
  { down = false, listingDown = false }: { down?: boolean; listingDown?: boolean } = {}
) => {
  const requests: string[] = []
  const server = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen: () => {} }, request => {
    const { pathname } = new URL(request.url)
    requests.push(pathname)

    if (down || (listingDown && pathname.endsWith('/meta.json'))) {
      return new Response('unavailable', { status: 500 })
    }

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

    if (found?.broken) {
      return new Response('unavailable', { status: 500 })
    }

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
  run: (projectPath: string) => Promise<void>,
  { lockedCores = [] }: { lockedCores?: string[] } = {}
): Promise<void> => {
  const projectPath = await Deno.makeTempDir()
  await Deno.writeTextFile(
    join(projectPath, 'deno.json'),
    JSON.stringify({ name: '@acme/my-api', version: '1.0.0', imports })
  )
  await Deno.writeTextFile(
    join(projectPath, 'deno.lock'),
    JSON.stringify({
      version: '5',
      jsr: Object.fromEntries(lockedCores.map(version => [`@skmtc/core@${version}`, { integrity: 'x' }]))
    })
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
    const requests = await withRegistry(servers, async () => {
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
    // The common case reads the CLI version's deno.json and the listing, together.
    assertEquals(requests.sort(), ['/@skmtc/server/0.3.34/deno.json', '/@skmtc/server/meta.json'])
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
            "Move the project's generators to a core that a published server accepts."
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

Deno.test(
  'pinServerForPublish - a core newer than the CLI server takes: stops after one read',
  async () => {
    const requests = await withRegistry(servers, async () => {
      await withProject({ '@skmtc/core': 'jsr:@skmtc/core@0.45.0' }, async projectPath => {
        const error = await assertRejects(
          () => pinServerForPublish(projectPath, { cliVersion }),
          NoServerForCoreError
        )
        assertStringIncludes(error.message, '@skmtc/core 0.45.0 (tried 0.3.34)')
        // Only here can a newer CLI help.
        assertStringIncludes(error.message, 'update the CLI')
        assertEquals(error.reason, 'core-too-new')
      })
    })
    assertEquals(requests.sort(), ['/@skmtc/server/0.3.34/deno.json', '/@skmtc/server/meta.json'])
  }
)

Deno.test(
  'pinServerForPublish - stops at the first server whose core is older than the project core',
  async () => {
    // 0.3.32 takes 0.43.x only and 0.44.0 is newer, so 0.3.10 is not tried.
    const releases = {
      '0.3.10': { core: '^0.40.0' },
      '0.3.32': { core: '^0.43.0' },
      '0.3.33': { core: '^0.44.1' },
      '0.3.34': { core: '^0.44.2' }
    }
    await withRegistry(releases, async () => {
      await withProject({ '@skmtc/core': 'jsr:@skmtc/core@0.44.0' }, async projectPath => {
        const error = await assertRejects(
          () => pinServerForPublish(projectPath, { cliVersion }),
          NoServerForCoreError
        )
        assertStringIncludes(error.message, '(tried 3 versions, 0.3.34 down to 0.3.32)')
      })
    })
  }
)

Deno.test(
  'pinServerForPublish - an unreadable registry pins the CLI version, with a warning',
  async () => {
    const warnings: string[] = []
    const errorStub = stub(console, 'error', (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    })
    try {
      await withRegistry(
        servers,
        async () => {
          await withProject({ '@skmtc/core': 'jsr:@skmtc/core@0.44.1' }, async projectPath => {
            const change = await pinServerForPublish(projectPath, { cliVersion })
            assertEquals(change?.to, 'jsr:@skmtc/server@0.3.34')
          })
        },
        { down: true }
      )
    } finally {
      errorStub.restore()
    }
    assertEquals(warnings.length, 1)
    assertStringIncludes(warnings[0], 'could not read @skmtc/server 0.3.34 from the registry')
  }
)

Deno.test(
  'pinServerForPublish - an unreadable listing after the CLI version does not fit stops the deploy',
  async () => {
    // Falling back to 0.3.34 here would put two cores in deno.lock, the #3652 failure.
    await withRegistry(
      servers,
      async () => {
        await withProject({ '@skmtc/core': 'jsr:@skmtc/core@0.44.1' }, async projectPath => {
          const before = await Deno.readTextFile(join(projectPath, 'deno.json'))
          const error = await assertRejects(() => pinServerForPublish(projectPath, { cliVersion }))
          assertStringIncludes(
            String(error),
            "@skmtc/server 0.3.34 does not accept the project's @skmtc/core 0.44.1"
          )
          assertEquals(await Deno.readTextFile(join(projectPath, 'deno.json')), before)
        })
      },
      { listingDown: true }
    )
  }
)

Deno.test("pinServerForPublish - never picks a server below 0.1.0, which cannot read the hub's request", async () => {
  // 0.0.900 takes core 0.43 but predates `protocol` in `/artifacts`.
  const releases = {
    '0.0.900': { core: '^0.43.0' },
    '0.3.33': { core: '^0.44.1' },
    '0.3.34': { core: '^0.44.2' }
  }
  await withRegistry(releases, async () => {
    await withProject({ '@skmtc/core': 'jsr:@skmtc/core@0.43.0' }, async projectPath => {
      const error = await assertRejects(
        () => pinServerForPublish(projectPath, { cliVersion }),
        NoServerForCoreError
      )
      assertStringIncludes(error.message, '(tried 2 versions, 0.3.34 down to 0.3.33)')
    })
  })
})

Deno.test('pinServerForPublish - a failed read after a fitting newer version does not stop the search', async () => {
  // 0.3.33 fits; 0.3.32, read in the same batch, answers 500.
  const releases = { ...servers, '0.3.32': { core: '^0.44.0', broken: true } }
  await withRegistry(releases, async () => {
    await withProject({ '@skmtc/core': 'jsr:@skmtc/core@0.44.1' }, async projectPath => {
      const change = await pinServerForPublish(projectPath, { cliVersion })
      assertEquals(change?.to, 'jsr:@skmtc/server@0.3.33')
    })
  })
})

Deno.test('pinServerForPublish - a failed read before any version fits stops, with the version named', async () => {
  const releases = { ...servers, '0.3.33': { core: '^0.44.1', broken: true } }
  await withRegistry(releases, async () => {
    await withProject({ '@skmtc/core': 'jsr:@skmtc/core@0.44.1' }, async projectPath => {
      const error = await assertRejects(() => pinServerForPublish(projectPath, { cliVersion }))
      assertStringIncludes(String(error), 'could not read @skmtc/server 0.3.33')
    })
  })
})

Deno.test('pinServerForPublish - the CLI version missing from the registry pins it, with a warning', async () => {
  const warnings: string[] = []
  const errorStub = stub(console, 'error', (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
  })
  try {
    await withRegistry(servers, async () => {
      await withProject({ '@skmtc/core': 'jsr:@skmtc/core@0.44.1' }, async projectPath => {
        // A mirror without the CLI's server version: a 404, not a search.
        const change = await pinServerForPublish(projectPath, { cliVersion: '0.3.40' })
        assertEquals(change?.to, 'jsr:@skmtc/server@0.3.40')
      })
    })
  } finally {
    errorStub.restore()
  }
  assertEquals(warnings.length, 1)
  assertStringIncludes(warnings[0], 'could not read @skmtc/server 0.3.40 from the registry')
})

Deno.test('pinServerForPublish - a yanked CLI version is not pinned', async () => {
  const releases = { ...servers, '0.3.34': { core: '^0.44.1', yanked: true } }
  await withRegistry(releases, async () => {
    await withProject({ '@skmtc/core': 'jsr:@skmtc/core@0.44.1' }, async projectPath => {
      const change = await pinServerForPublish(projectPath, { cliVersion })
      assertEquals(change?.to, 'jsr:@skmtc/server@0.3.33')
    })
  })
})

Deno.test('pinServerForPublish - a ranged core pin uses the version deno.lock resolves', async () => {
  // #3652 again with a range: the lock holds 0.44.1, so 0.3.34 (^0.44.2) would add a second core.
  await withRegistry(servers, async () => {
    await withProject(
      { '@skmtc/core': 'jsr:@skmtc/core@^0.44.1' },
      async projectPath => {
        const change = await pinServerForPublish(projectPath, { cliVersion })
        assertEquals(change?.to, 'jsr:@skmtc/server@0.3.33')
      },
      { lockedCores: ['0.44.1'] }
    )
  })
})

Deno.test('pinServerForPublish - a ranged core pin with no single locked core stops', async () => {
  await withRegistry(servers, async () => {
    await withProject(
      { '@skmtc/core': 'jsr:@skmtc/core@^0.44.1' },
      async projectPath => {
        const error = await assertRejects(() => pinServerForPublish(projectPath, { cliVersion }))
        assertStringIncludes(String(error), 'more than one @skmtc/core (0.44.1, 0.44.2)')
        assertStringIncludes(String(error), 'Pin @skmtc/core exactly in deno.json')
      },
      { lockedCores: ['0.44.1', '0.44.2'] }
    )
  })
})
