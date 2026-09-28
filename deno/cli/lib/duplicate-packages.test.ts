import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { existsSync } from '@std/fs/exists'
import { ensureDir } from '@std/fs/ensure-dir'
import { join } from '@std/path/join'
import { resolve } from '@std/path/resolve'
import { toFileUrl } from '@std/path/to-file-url'
import {
  checkModuleGraph,
  type ModuleGraph,
  type ReadManifestFn,
  toDuplicatePackagesMessage,
  toModuleGraphCheck
} from '@/lib/duplicate-packages.ts'
import { toWorker } from '@/lib/to-worker.ts'
import {
  twoCoreRegistry,
  withJsrRegistryServer,
  withRegistryProject
} from '@/tests/mocks/jsr-registry-server.mock.ts'

const projectPath = resolve('/root/.skmtc/api')

/** No local manifests — for graphs whose modules all come from registries. */
const noManifests: ReadManifestFn = () => undefined

type ModuleArgs = {
  specifier: string
  dependencies?: string[]
  error?: string
}

const toModule = ({ specifier, dependencies = [], error }: ModuleArgs) => ({
  specifier,
  error,
  dependencies: dependencies.map(dependency => ({ code: { specifier: dependency } }))
})

const toLocalUrl = (first: string, ...segments: string[]): string =>
  toFileUrl(join(first, ...segments)).href

/**
 * The graph from the ticket's reproduction (CLI 0.9.47 + the current
 * stock generators), trimmed to one module per package.
 */
const ticketGraph: ModuleGraph = {
  modules: [
    toModule({
      specifier: toLocalUrl(projectPath, 'worker.ts'),
      dependencies: [
        'jsr:@skmtc/worker@0.3.55',
        'jsr:@skmtc/gen-typescript@0.2.7',
        'jsr:@skmtc/gen-zod@0.2.7'
      ]
    }),
    toModule({
      specifier: 'https://jsr.io/@skmtc/worker/0.3.55/mod.ts',
      dependencies: ['jsr:@skmtc/core@0.28.7', 'jsr:@skmtc/core@0.28.7/Settings']
    }),
    toModule({
      specifier: 'https://jsr.io/@skmtc/gen-typescript/0.2.7/mod.ts',
      dependencies: ['jsr:@skmtc/core@0.29.0', 'jsr:@skmtc/lang-typescript@0.12.22']
    }),
    toModule({
      specifier: 'https://jsr.io/@skmtc/gen-zod/0.2.7/mod.ts',
      dependencies: ['jsr:@skmtc/core@0.29.0', 'jsr:@skmtc/lang-typescript@0.12.22']
    }),
    toModule({
      specifier: 'https://jsr.io/@skmtc/lang-typescript/0.12.22/mod.ts',
      dependencies: ['jsr:@skmtc/core@0.29.0']
    }),
    toModule({
      specifier: 'https://jsr.io/@skmtc/core/0.28.7/mod.ts',
      dependencies: ['https://jsr.io/@skmtc/core/0.28.7/dsl/Definition.ts']
    }),
    toModule({ specifier: 'https://jsr.io/@skmtc/core/0.28.7/dsl/Definition.ts' }),
    toModule({ specifier: 'https://jsr.io/@skmtc/core/0.28.7/types/Settings.ts' }),
    toModule({ specifier: 'https://jsr.io/@skmtc/core/0.29.0/mod.ts' })
  ],
  redirects: {
    'jsr:@skmtc/worker@0.3.55': 'https://jsr.io/@skmtc/worker/0.3.55/mod.ts',
    'jsr:@skmtc/gen-typescript@0.2.7': 'https://jsr.io/@skmtc/gen-typescript/0.2.7/mod.ts',
    'jsr:@skmtc/gen-zod@0.2.7': 'https://jsr.io/@skmtc/gen-zod/0.2.7/mod.ts',
    'jsr:@skmtc/lang-typescript@0.12.22': 'https://jsr.io/@skmtc/lang-typescript/0.12.22/mod.ts',
    'jsr:@skmtc/core@0.28.7': 'https://jsr.io/@skmtc/core/0.28.7/mod.ts',
    'jsr:@skmtc/core@0.28.7/Settings': 'https://jsr.io/@skmtc/core/0.28.7/types/Settings.ts',
    'jsr:@skmtc/core@0.29.0': 'https://jsr.io/@skmtc/core/0.29.0/mod.ts'
  }
}

const check = (graph: ModuleGraph, readManifest: ReadManifestFn = noManifests) =>
  toModuleGraphCheck({ graph, projectPath, readManifest })

Deno.test('toModuleGraphCheck - names each core version and the packages that import it', () => {
  assertEquals(check(ticketGraph), {
    type: 'duplicates',
    duplicates: [
      {
        name: '@skmtc/core',
        copies: [
          { version: '0.28.7', importedBy: ['@skmtc/worker@0.3.55'] },
          {
            version: '0.29.0',
            importedBy: [
              '@skmtc/gen-typescript@0.2.7',
              '@skmtc/gen-zod@0.2.7',
              '@skmtc/lang-typescript@0.12.22'
            ]
          }
        ]
      }
    ]
  })
})

Deno.test('toModuleGraphCheck - one core is not a duplicate', () => {
  const graph: ModuleGraph = {
    modules: [
      toModule({
        specifier: 'https://jsr.io/@skmtc/worker/0.3.56/mod.ts',
        dependencies: ['jsr:@skmtc/core@0.29.0']
      }),
      toModule({
        specifier: 'https://jsr.io/@skmtc/gen-zod/0.2.7/mod.ts',
        dependencies: ['jsr:@skmtc/core@0.29.0', 'jsr:@skmtc/lang-typescript@0.12.22']
      }),
      toModule({
        specifier: 'https://jsr.io/@skmtc/lang-typescript/0.12.22/mod.ts',
        dependencies: ['jsr:@skmtc/core@0.29.0']
      })
    ],
    redirects: {
      'jsr:@skmtc/core@0.29.0': 'https://jsr.io/@skmtc/core/0.29.0/mod.ts',
      'jsr:@skmtc/lang-typescript@0.12.22': 'https://jsr.io/@skmtc/lang-typescript/0.12.22/mod.ts'
    }
  }

  assertEquals(check(graph), {
    type: 'single-copies',
    packages: [
      {
        name: '@skmtc/core',
        copies: [
          {
            version: '0.29.0',
            importedBy: [
              '@skmtc/gen-zod@0.2.7',
              '@skmtc/lang-typescript@0.12.22',
              '@skmtc/worker@0.3.56'
            ]
          }
        ]
      },
      {
        name: '@skmtc/lang-typescript',
        copies: [{ version: '0.12.22', importedBy: ['@skmtc/gen-zod@0.2.7'] }]
      }
    ]
  })
})

Deno.test('toModuleGraphCheck - flags two copies of a lang package', () => {
  const graph: ModuleGraph = {
    modules: [
      toModule({
        specifier: 'https://jsr.io/@skmtc/gen-zod/0.2.7/mod.ts',
        dependencies: ['https://jsr.io/@skmtc/lang-typescript/0.12.22/mod.ts']
      }),
      toModule({
        specifier: 'https://jsr.io/@skmtc/gen-typescript/0.2.6/mod.ts',
        dependencies: ['https://jsr.io/@skmtc/lang-typescript/0.12.10/mod.ts']
      })
    ]
  }

  const result = check(graph)

  assertEquals(result.type === 'duplicates' ? result.duplicates : [], [
    {
      name: '@skmtc/lang-typescript',
      copies: [
        { version: '0.12.10', importedBy: ['@skmtc/gen-typescript@0.2.6'] },
        { version: '0.12.22', importedBy: ['@skmtc/gen-zod@0.2.7'] }
      ]
    }
  ])
})

Deno.test('toModuleGraphCheck - groups the project files that import a copy by top-level directory', () => {
  const graph: ModuleGraph = {
    modules: [
      toModule({
        specifier: toLocalUrl(projectPath, 'gen-local', 'src', 'model.ts'),
        dependencies: ['https://jsr.io/@skmtc/core/0.28.3/mod.ts']
      }),
      toModule({
        specifier: toLocalUrl(projectPath, 'gen-local', 'src', 'operation.ts'),
        dependencies: ['https://jsr.io/@skmtc/core/0.28.3/mod.ts']
      }),
      toModule({
        specifier: 'https://jsr.io/@skmtc/worker/0.3.56/mod.ts',
        dependencies: ['https://jsr.io/@skmtc/core/0.29.0/mod.ts']
      })
    ]
  }

  const result = check(graph)

  assertEquals(result.type === 'duplicates' ? result.duplicates[0].copies : [], [
    { version: '0.28.3', importedBy: ['gen-local'] },
    { version: '0.29.0', importedBy: ['@skmtc/worker@0.3.56'] }
  ])
})

Deno.test('toModuleGraphCheck - an entry outside the project is named by its file name', () => {
  const entryPath = resolve('/tmp/skmtc-bundle-1/worker.ts')
  const graph: ModuleGraph = {
    modules: [
      toModule({
        specifier: toFileUrl(entryPath).href,
        dependencies: ['https://jsr.io/@skmtc/core/0.28.3/mod.ts']
      }),
      toModule({
        specifier: 'https://jsr.io/@skmtc/worker/0.3.56/mod.ts',
        dependencies: ['https://jsr.io/@skmtc/core/0.29.0/mod.ts']
      })
    ]
  }

  const result = toModuleGraphCheck({ graph, projectPath, entryPath, readManifest: noManifests })

  assertEquals(result.type === 'duplicates' ? result.duplicates[0].copies : [], [
    { version: '0.28.3', importedBy: ['worker.ts'] },
    { version: '0.29.0', importedBy: ['@skmtc/worker@0.3.56'] }
  ])
})

Deno.test('toModuleGraphCheck - a local checkout of core is a second copy beside the JSR one', () => {
  // `"@skmtc/core": "../../core/mod.ts"` for a local generator, while the
  // worker loads jsr:@skmtc/core — same version, two copies at runtime.
  const coreDirectory = resolve(projectPath, '..', '..', 'core')
  const readManifest: ReadManifestFn = directory =>
    directory === coreDirectory ? { name: '@skmtc/core', version: '0.29.0' } : undefined
  const graph: ModuleGraph = {
    modules: [
      toModule({
        specifier: toLocalUrl(projectPath, 'gen-local', 'mod.ts'),
        dependencies: [toLocalUrl(coreDirectory, 'mod.ts')]
      }),
      toModule({
        specifier: toLocalUrl(coreDirectory, 'mod.ts'),
        dependencies: [toLocalUrl(coreDirectory, 'dsl', 'Definition.ts')]
      }),
      toModule({
        specifier: 'https://jsr.io/@skmtc/worker/0.3.56/mod.ts',
        dependencies: ['https://jsr.io/@skmtc/core/0.29.0/mod.ts']
      })
    ]
  }

  const result = check(graph, readManifest)

  assertEquals(result.type === 'duplicates' ? result.duplicates[0].copies : [], [
    { version: '0.29.0', importedBy: ['@skmtc/worker@0.3.56'] },
    { version: `0.29.0 (${join('..', '..', 'core')})`, importedBy: ['gen-local'] }
  ])
})

Deno.test('toModuleGraphCheck - an npm copy of core is a second copy beside the JSR one', () => {
  const graph: ModuleGraph = {
    modules: [
      toModule({
        specifier: 'https://jsr.io/@skmtc/gen-zod/0.2.7/mod.ts',
        dependencies: ['npm:@skmtc/core@0.29.0']
      }),
      toModule({
        specifier: 'https://jsr.io/@skmtc/worker/0.3.56/mod.ts',
        dependencies: ['https://jsr.io/@skmtc/core/0.29.0/mod.ts']
      }),
      toModule({ specifier: 'npm:/@skmtc/core@0.29.0' })
    ],
    redirects: { 'npm:@skmtc/core@0.29.0': 'npm:/@skmtc/core@0.29.0' }
  }

  const result = check(graph)

  assertEquals(result.type === 'duplicates' ? result.duplicates[0].copies : [], [
    { version: '0.29.0', importedBy: ['@skmtc/worker@0.3.56'] },
    { version: '0.29.0 (npm)', importedBy: ['@skmtc/gen-zod@0.2.7'] }
  ])
})

Deno.test('toModuleGraphCheck - a copy from another host counts', () => {
  const graph: ModuleGraph = {
    modules: [
      toModule({
        specifier: 'https://jsr.io/@skmtc/worker/0.3.56/mod.ts',
        dependencies: [
          'https://jsr.io/@skmtc/core/0.29.0/mod.ts',
          'https://esm.sh/@skmtc/core@0.28.7/mod.ts'
        ]
      })
    ]
  }

  const result = check(graph)

  assertEquals(
    result.type === 'duplicates' ? result.duplicates[0].copies.map(copy => copy.version) : [],
    ['0.28.7', '0.29.0']
  )
})

Deno.test('toModuleGraphCheck - an `import type` edge is not a runtime copy', () => {
  const graph: ModuleGraph = {
    modules: [
      {
        specifier: 'https://jsr.io/@skmtc/gen-zod/0.2.7/mod.ts',
        dependencies: [
          { code: { specifier: 'https://jsr.io/@skmtc/core/0.29.0/mod.ts' } },
          // `deno info` records `import type` under `type` only.
          { specifier: '@skmtc/core-old' }
        ]
      },
      toModule({
        specifier: 'https://jsr.io/@skmtc/worker/0.3.56/mod.ts',
        dependencies: ['https://jsr.io/@skmtc/core/0.29.0/mod.ts']
      })
    ]
  }

  assertEquals(check(graph).type, 'single-copies')
})

Deno.test('toModuleGraphCheck - an unresolved import leaves duplicates visible', () => {
  const withUnresolved = (graph: ModuleGraph): ModuleGraph => ({
    ...graph,
    modules: [
      ...graph.modules,
      {
        specifier: toLocalUrl(projectPath, 'gen-local', 'mod.ts'),
        dependencies: [
          { specifier: 'some-lib', code: { error: 'Import "some-lib" not a dependency' } }
        ]
      }
    ]
  })

  assertEquals(check(withUnresolved(ticketGraph)).type, 'duplicates')

  const single = check(withUnresolved({ modules: ticketGraph.modules.slice(4) }))
  assertEquals(single.type, 'unavailable')
  assertStringIncludes(single.type === 'unavailable' ? single.reason : '', 'some-lib')
})

Deno.test('toModuleGraphCheck - a module that failed to load leaves the check unavailable', () => {
  const graph: ModuleGraph = {
    modules: [
      toModule({
        specifier: 'https://jsr.io/@skmtc/worker/0.3.56/mod.ts',
        dependencies: ['https://jsr.io/@skmtc/core/0.29.0/mod.ts']
      }),
      toModule({ specifier: 'jsr:@skmtc/gen-zod@0.2.7', error: 'failed to load' })
    ]
  }

  const result = check(graph)

  assertEquals(result.type, 'unavailable')
  assertStringIncludes(result.type === 'unavailable' ? result.reason : '', 'jsr:@skmtc/gen-zod')
})

Deno.test('toModuleGraphCheck - finding no core is unavailable, not a pass', () => {
  const graph: ModuleGraph = {
    modules: [toModule({ specifier: toLocalUrl(projectPath, 'worker.ts'), dependencies: [] })]
  }

  assertEquals(check(graph).type, 'unavailable')
})

Deno.test('toDuplicatePackagesMessage - names the versions, the packages and the fix', () => {
  const result = check(ticketGraph)
  const message = toDuplicatePackagesMessage({
    projectName: 'api',
    projectPath,
    duplicates: result.type === 'duplicates' ? result.duplicates : []
  })

  assertStringIncludes(message, 'Project "api" resolves more than one copy of @skmtc/core')
  assertStringIncludes(message, '@skmtc/core 0.28.7 ← @skmtc/worker@0.3.55')
  assertStringIncludes(
    message,
    '@skmtc/core 0.29.0 ← @skmtc/gen-typescript@0.2.7, @skmtc/gen-zod@0.2.7, @skmtc/lang-typescript@0.12.22'
  )
  assertStringIncludes(message, 'empty files')
  assertStringIncludes(message, join(projectPath, 'deno.json'))
  assertStringIncludes(message, 'skmtc generate api')
})

Deno.test('checkModuleGraph - resolves two cores from a real `deno info` run', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject({ generatorVersion: '0.2.0' }, async ({ projectPath }) => {
      assertEquals(await checkModuleGraph(projectPath), {
        type: 'duplicates',
        duplicates: [
          {
            name: '@skmtc/core',
            copies: [
              { version: '0.1.0', importedBy: ['@skmtc/worker@0.1.0', 'worker.ts'] },
              { version: '0.2.0', importedBy: ['@skmtc/gen-a@0.2.0'] }
            ]
          }
        ]
      })
    })
  })
})

Deno.test('checkModuleGraph - resolves one core from a real `deno info` run', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject({ generatorVersion: '0.1.0' }, async ({ projectPath }) => {
      assertEquals(await checkModuleGraph(projectPath), {
        type: 'single-copies',
        packages: [
          {
            name: '@skmtc/core',
            copies: [
              {
                version: '0.1.0',
                importedBy: ['@skmtc/gen-a@0.1.0', '@skmtc/worker@0.1.0', 'worker.ts']
              }
            ]
          }
        ]
      })
    })
  })
})

Deno.test('checkModuleGraph - finds a local core checkout beside the JSR core', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject(
      {
        generatorVersion: '0.1.0',
        imports: {
          '@skmtc/core': './localcore/mod.ts',
          '@skmtc/gen-local': './gen-local/mod.ts'
        }
      },
      async ({ projectPath }) => {
        // A different version from the JSR core: Deno resolves
        // jsr:@skmtc/core@0.1.0 to a local package of the same name and
        // version, which would make it one copy.
        await ensureDir(join(projectPath, 'localcore'))
        await ensureDir(join(projectPath, 'gen-local'))
        await Deno.writeTextFile(
          join(projectPath, 'localcore', 'deno.json'),
          JSON.stringify({ name: '@skmtc/core', version: '0.3.0', exports: './mod.ts' })
        )
        await Deno.writeTextFile(
          join(projectPath, 'localcore', 'mod.ts'),
          'export class Definition {}\n'
        )
        await Deno.writeTextFile(
          join(projectPath, 'gen-local', 'mod.ts'),
          "import { Definition } from '@skmtc/core'\nexport default { id: '@skmtc/gen-local', Definition }\n"
        )

        const result = await checkModuleGraph(projectPath)

        assertEquals(result.type === 'duplicates' ? result.duplicates[0].copies : [], [
          { version: '0.1.0', importedBy: ['@skmtc/gen-a@0.1.0', '@skmtc/worker@0.1.0'] },
          { version: '0.3.0 (localcore)', importedBy: ['gen-local', 'worker.ts'] }
        ])
      }
    )
  })
})

Deno.test('checkModuleGraph - an unmapped import does not hide two cores', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject({ generatorVersion: '0.2.0' }, async ({ projectPath }) => {
      await Deno.writeTextFile(
        join(projectPath, 'worker.ts'),
        `import 'unmapped-bare'\n${toWorker(['@skmtc/gen-a'])}`
      )

      assertEquals((await checkModuleGraph(projectPath)).type, 'duplicates')
    })
  })
})

Deno.test('checkModuleGraph - frozen never writes deno.lock', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject({ generatorVersion: '0.2.0' }, async ({ projectPath }) => {
      const result = await checkModuleGraph(projectPath, { frozen: true })

      assertEquals(result.type, 'unavailable')
      assertStringIncludes(result.type === 'unavailable' ? result.reason : '', 'deno.lock')
      assertEquals(existsSync(join(projectPath, 'deno.lock')), false)

      // Once a bundle attempt has written the lock, frozen reads it.
      await checkModuleGraph(projectPath)
      assertEquals((await checkModuleGraph(projectPath, { frozen: true })).type, 'duplicates')
    })
  })
})

Deno.test('checkModuleGraph - gives up after the timeout', async () => {
  await withJsrRegistryServer(twoCoreRegistry, async () => {
    await withRegistryProject({ generatorVersion: '0.2.0' }, async ({ projectPath }) => {
      const result = await checkModuleGraph(projectPath, { timeoutMs: 1 })

      assertEquals(result.type, 'unavailable')
      assertStringIncludes(result.type === 'unavailable' ? result.reason : '', 'took longer')
    })
  })
})

Deno.test('checkModuleGraph - a project without worker.ts is unavailable', async () => {
  const emptyProjectPath = await Deno.makeTempDir()
  try {
    assertEquals((await checkModuleGraph(emptyProjectPath)).type, 'unavailable')
  } finally {
    await Deno.remove(emptyProjectPath, { recursive: true })
  }
})
