import { assertEquals, assertRejects } from '@std/assert'
import { exists } from '@std/fs/exists'
import { CoreConflictError } from '@/lib/stack-core.ts'
import { join } from '@std/path/join'
import { ensureDir } from '@std/fs/ensure-dir'
import { homedir } from 'node:os'
import { cloneGenerators, Generator } from '@/lib/generator.ts'
import { RootDenoJson } from '@/lib/root-deno-json.ts'
import { Manager } from '@/lib/manager.ts'

Deno.test('Generator.create - creates instance with correct properties', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  assertEquals(generator.projectName, 'my-project')
  assertEquals(generator.scopeName, '@skmtc')
  assertEquals(generator.packageName, 'test-generator')
  assertEquals(generator.version, '1.0.0')
})

Deno.test('Generator.fromName - creates instance from name components', () => {
  const generator = Generator.fromName({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '2.0.0'
  })

  assertEquals(generator.projectName, 'my-project')
  assertEquals(generator.scopeName, '@skmtc')
  assertEquals(generator.packageName, 'test-generator')
  assertEquals(generator.version, '2.0.0')
})

Deno.test('Generator.toModuleName - returns correct module name format', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  const moduleName = generator.toModuleName()

  assertEquals(moduleName, '@skmtc/test-generator')
})

Deno.test('Generator.toModuleName - handles scope without @ prefix', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: 'skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  const moduleName = generator.toModuleName()

  assertEquals(moduleName, 'skmtc/test-generator')
})

Deno.test('Generator.toFullName - returns full JSR reference with version', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.2.3'
  })

  const fullName = generator.toFullName()

  assertEquals(fullName, 'jsr:@skmtc/test-generator@1.2.3')
})

Deno.test('Generator.toPath - returns relative path when relative is true', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  const path = generator.toPath({ relative: true })

  assertEquals(path, './test-generator')
})

Deno.test('Generator.toPath - returns absolute path when relative is false', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  const path = generator.toPath({ relative: false })

  // Path should end with the package name and include .skmtc
  assertEquals(path.includes('.skmtc'), true)
  assertEquals(path.endsWith(join('my-project', 'test-generator')), true)
})

Deno.test('Generator.toModPath - returns relative mod.ts path when relative is true', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  const modPath = generator.toModPath({ relative: true })

  assertEquals(modPath, './test-generator/mod.ts')
})

Deno.test('Generator.toModPath - returns absolute mod.ts path when relative is false', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  const modPath = generator.toModPath({ relative: false })

  // Path should end with mod.ts and include package name
  assertEquals(modPath.endsWith('test-generator/mod.ts'), true)
  assertEquals(modPath.includes('.skmtc'), true)
})

Deno.test('Generator - handles hyphenated package names correctly', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'shadcn-ui',
    version: '1.0.0'
  })

  assertEquals(generator.toModuleName(), '@skmtc/shadcn-ui')
  assertEquals(generator.toPath({ relative: true }), './shadcn-ui')
  assertEquals(generator.toModPath({ relative: true }), './shadcn-ui/mod.ts')
})

Deno.test('Generator - handles different scopes correctly', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@custom-org',
    packageName: 'my-generator',
    version: '0.1.0'
  })

  assertEquals(generator.toModuleName(), '@custom-org/my-generator')
  assertEquals(generator.toFullName(), 'jsr:@custom-org/my-generator@0.1.0')
})

Deno.test('Generator - handles version strings with various formats', () => {
  const semverGen = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-gen',
    version: '1.2.3'
  })
  assertEquals(semverGen.toFullName(), 'jsr:@skmtc/test-gen@1.2.3')

  const majorMinor = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-gen',
    version: '2.0'
  })
  assertEquals(majorMinor.toFullName(), 'jsr:@skmtc/test-gen@2.0')

  const latest = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-gen',
    version: 'latest'
  })
  assertEquals(latest.toFullName(), 'jsr:@skmtc/test-gen@latest')
})

Deno.test('Generator - multiple generators in same project have different package names', () => {
  const gen1 = Generator.create({
    projectName: 'shared-project',
    scopeName: '@skmtc',
    packageName: 'generator-one',
    version: '1.0.0'
  })
  const gen2 = Generator.create({
    projectName: 'shared-project',
    scopeName: '@skmtc',
    packageName: 'generator-two',
    version: '1.0.0'
  })
  // Both should have same project but different paths
  assertEquals(gen1.projectName, gen2.projectName)
  assertEquals(gen1.toPath({ relative: true }) !== gen2.toPath({ relative: true }), true)
  assertEquals(gen1.toModuleName() !== gen2.toModuleName(), true)
})

/**
 * A published package as JSR serves it: its `deno.json` carries the
 * pins, while its source has each bare import resolved to a versioned
 * `jsr:` / `npm:` specifier — including the test file, which JSR leaves
 * out of the version's module graph.
 */
const publishedFiles: Record<string, string> = {
  '/deno.json': JSON.stringify({
    name: '@skmtc/gen-fixture',
    version: '0.2.8',
    exports: './mod.ts',
    imports: {
      '@skmtc/core': 'jsr:@skmtc/core@0.29.0',
      '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@0.2.7',
      '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@0.2.7'
    }
  }),
  '/mod.ts': `export { QueryFn } from './src/QueryFn.ts'\n`,
  '/src/QueryFn.ts': [
    `import { capitalize } from 'jsr:@skmtc/core@0.29.0'`,
    `import type { OasOperationProjectionConstructorArgs } from 'jsr:@skmtc/core@0.29.0'`,
    `import { ZodProjection } from 'jsr:@skmtc/gen-zod@0.2.7'`,
    `import { TsProjection } from 'jsr:@skmtc/gen-typescript@0.2.7'`,
    `import { match } from 'npm:ts-pattern@^5.8.0'`,
    `import { join } from 'jsr:@std/path@1.0.8/join'`,
    `import { TanstackQueryBase } from './base.ts'`,
    "const emitted = `import { Hono } from 'jsr:@hono/hono@4.6.0'`"
  ].join('\n'),
  '/test/e2e.test.ts': [
    `import { assertStringIncludes } from 'jsr:@std/assert@^1.0.0'`,
    `import { capitalize } from 'jsr:@skmtc/core@0.29.0'`,
    `assertStringIncludes(capitalize('a'), \`import { b } from 'jsr:@skmtc/core@0.29.0'\`)`
  ].join('\n'),
  '/README.md': `import { capitalize } from 'jsr:@skmtc/core@0.29.0'\n`
}

/** A second published package on the same core as gen-fixture 0.2.8. */
const peerFiles: Record<string, string> = {
  '/deno.json': JSON.stringify({
    name: '@skmtc/gen-peer',
    version: '0.3.0',
    exports: './mod.ts',
    imports: { '@skmtc/core': 'jsr:@skmtc/core@0.29.0' }
  }),
  '/mod.ts': `export const peer = 'peer'\n`
}

/** gen-zod, which gen-fixture's published deno.json imports, on the same core. */
const zodFiles: Record<string, string> = {
  '/deno.json': JSON.stringify({
    name: '@skmtc/gen-zod',
    version: '0.2.7',
    exports: './mod.ts',
    imports: { '@skmtc/core': 'jsr:@skmtc/core@0.29.0' }
  }),
  '/mod.ts': `export const zod = 'zod'\n`
}

const fixturePackages: Record<string, { version: string; files: Record<string, string> }> = {
  'gen-fixture': { version: '0.2.8', files: publishedFiles },
  'gen-peer': { version: '0.3.0', files: peerFiles },
  'gen-zod': { version: '0.2.7', files: zodFiles }
}

const notFound = () => new Response('not found', { status: 404 })

const toFixtureResponse = (url: string): Response => {
  const path = new URL(url).pathname.replace(/\/+/g, '/')
  const found = path.match(/\/@skmtc\/([^/]+)\/(.+)$/)

  if (found === null) {
    return notFound()
  }

  const [, name, rest] = found
  const fixture = fixturePackages[name]

  if (fixture === undefined) {
    return notFound()
  }

  if (rest === 'meta.json') {
    return Response.json({
      scope: 'skmtc',
      name,
      latest: fixture.version,
      versions: { [fixture.version]: {} }
    })
  }

  if (rest === `${fixture.version}_meta.json`) {
    const manifest = Object.fromEntries(
      Object.keys(fixture.files).map(key => [key, { size: 0, checksum: '' }])
    )
    return Response.json({ manifest })
  }

  const file = rest.startsWith(`${fixture.version}/`)
    ? fixture.files[rest.slice(fixture.version.length)]
    : undefined

  return file === undefined ? notFound() : new Response(file)
}

Deno.test('Generator.clone - rewrites versioned imports to bare specifiers', async () => {
  const tempRoot = await Deno.makeTempDir({ prefix: 'skmtc-clone-', dir: homedir() })
  const prevCwd = Deno.cwd()
  const originalFetch = globalThis.fetch

  try {
    const projectName = 'clone-test'
    const projectPath = join(tempRoot, '.skmtc', projectName)
    await ensureDir(projectPath)
    // The project pins a different core patch, and an earlier clone of
    // gen-typescript. It has no gen-zod.
    await Deno.writeTextFile(
      join(projectPath, 'deno.json'),
      JSON.stringify({
        imports: {
          '@skmtc/core': 'jsr:@skmtc/core@0.29.1',
          '@skmtc/gen-typescript': './gen-typescript/mod.ts'
        }
      })
    )

    Deno.chdir(tempRoot)
    globalThis.fetch = (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString()
      return Promise.resolve(toFixtureResponse(url))
    }

    const manager = new Manager()
    const denoJson = await RootDenoJson.open(projectName, manager)
    const generator = Generator.create({
      projectName,
      scopeName: '@skmtc',
      packageName: 'gen-fixture',
      version: '0.2.8'
    })

    await generator.clone({ denoJson, manager, force: true })
    await manager.cleanup()

    const clonePath = join(projectPath, 'gen-fixture')

    assertEquals(
      await Deno.readTextFile(join(clonePath, 'src', 'QueryFn.ts')),
      [
        `import { capitalize } from '@skmtc/core'`,
        `import type { OasOperationProjectionConstructorArgs } from '@skmtc/core'`,
        `import { ZodProjection } from '@skmtc/gen-zod'`,
        `import { TsProjection } from '@skmtc/gen-typescript'`,
        `import { match } from 'ts-pattern'`,
        `import { join } from '@std/path/join'`,
        `import { TanstackQueryBase } from './base.ts'`,
        "const emitted = `import { Hono } from 'jsr:@hono/hono@4.6.0'`"
      ].join('\n')
    )

    // Test files outside the module graph are rewritten too; a string
    // holding import text is not.
    assertEquals(
      await Deno.readTextFile(join(clonePath, 'test', 'e2e.test.ts')),
      [
        `import { assertStringIncludes } from '@std/assert'`,
        `import { capitalize } from '@skmtc/core'`,
        `assertStringIncludes(capitalize('a'), \`import { b } from 'jsr:@skmtc/core@0.29.0'\`)`
      ].join('\n')
    )

    // Only source files are rewritten.
    assertEquals(
      await Deno.readTextFile(join(clonePath, 'README.md')),
      publishedFiles['/README.md']
    )

    // The root decides every name it pins (core, the local
    // gen-typescript); the clone keeps the rest, plus a pin for each
    // bare name the published imports didn't name.
    const cloneDenoJson = JSON.parse(await Deno.readTextFile(join(clonePath, 'deno.json')))
    assertEquals(cloneDenoJson.imports, {
      '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@0.2.7',
      'ts-pattern': 'npm:ts-pattern@^5.8.0',
      '@std/path': 'jsr:@std/path@1.0.8',
      '@std/assert': 'jsr:@std/assert@^1.0.0'
    })

    // The root gains the clone and nothing else.
    const rootDenoJson = JSON.parse(await Deno.readTextFile(join(projectPath, 'deno.json')))
    assertEquals(rootDenoJson.imports, {
      '@skmtc/core': 'jsr:@skmtc/core@0.29.1',
      '@skmtc/gen-typescript': './gen-typescript/mod.ts',
      '@skmtc/gen-fixture': './gen-fixture/mod.ts'
    })
  } finally {
    globalThis.fetch = originalFetch
    Deno.chdir(prevCwd)
    await Deno.remove(tempRoot, { recursive: true })
  }
})

type CloneProjectArgs = {
  imports: Record<string, string>
  /** Extra files inside the project folder, by path relative to it. */
  files?: Record<string, string>
}

type CloneProject = {
  projectPath: string
  denoJson: RootDenoJson
  manager: Manager
  generator: Generator
}

/** A project in a temp root, with fetch answering for the gen-fixture package. */
const withCloneProject = async ({ imports, files = {} }: CloneProjectArgs, fn: (project: CloneProject) => Promise<void>) => {
  const tempRoot = await Deno.makeTempDir({ prefix: 'skmtc-clone-', dir: homedir() })
  const prevCwd = Deno.cwd()
  const originalFetch = globalThis.fetch

  try {
    const projectName = 'clone-test'
    const projectPath = join(tempRoot, '.skmtc', projectName)
    await ensureDir(projectPath)
    await Deno.writeTextFile(join(projectPath, 'deno.json'), JSON.stringify({ imports }))

    for (const [path, content] of Object.entries(files)) {
      await ensureDir(join(projectPath, path, '..'))
      await Deno.writeTextFile(join(projectPath, path), content)
    }

    Deno.chdir(tempRoot)
    globalThis.fetch = (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString()
      return Promise.resolve(toFixtureResponse(url))
    }

    const manager = new Manager()
    const denoJson = await RootDenoJson.open(projectName, manager)
    const generator = Generator.create({ projectName, scopeName: '@skmtc', packageName: 'gen-fixture', version: '0.2.8' })

    await fn({ projectPath, denoJson, manager, generator })
  } finally {
    globalThis.fetch = originalFetch
    Deno.chdir(prevCwd)
    await Deno.remove(tempRoot, { recursive: true })
  }
}

Deno.test('Generator.clone - pins the core the cloned version needs', async () => {
  // gen-fixture 0.2.8 pins core 0.29.0 exactly; nothing else in the
  // project names a core, so the project moves from 0.29.1 to 0.29.0.
  await withCloneProject(
    { imports: { '@skmtc/core': 'jsr:@skmtc/core@0.29.1', '@skmtc/gen-typescript': './gen-typescript/mod.ts' } },
    async ({ denoJson, manager, generator }) => {
      await generator.clone({ denoJson, manager })

      assertEquals(denoJson.contents.imports?.['@skmtc/core'], 'jsr:@skmtc/core@0.29.0')
      await manager.cleanup()
    }
  )
})

Deno.test('Generator.clone - refuses a version on another core and writes no files', async () => {
  // The local gen-typescript is on core 0.28.0 exactly; gen-fixture needs
  // 0.29.0. One bundle holds one core, so the clone stops.
  await withCloneProject(
    {
      imports: { '@skmtc/core': 'jsr:@skmtc/core@0.28.0', '@skmtc/gen-typescript': './gen-typescript/mod.ts' },
      files: {
        'gen-typescript/deno.json': JSON.stringify({ imports: { '@skmtc/core': 'jsr:@skmtc/core@0.28.0' } })
      }
    },
    async ({ projectPath, denoJson, manager, generator }) => {
      const error = await assertRejects(() => generator.clone({ denoJson, manager }), CoreConflictError)

      assertEquals(
        error.requirements.map(({ generatorId }) => generatorId).sort(),
        ['@skmtc/gen-fixture', '@skmtc/gen-typescript']
      )
      assertEquals(denoJson.contents.imports?.['@skmtc/core'], 'jsr:@skmtc/core@0.28.0')
      // The download stayed in memory: no clone folder exists.
      assertEquals(await exists(join(projectPath, 'gen-fixture')), false)
      await manager.cleanup()
    }
  )
})

Deno.test('Generator.clone - --force skips the core check and keeps the pin', async () => {
  await withCloneProject(
    {
      imports: { '@skmtc/core': 'jsr:@skmtc/core@0.28.0', '@skmtc/gen-typescript': './gen-typescript/mod.ts' },
      files: {
        'gen-typescript/deno.json': JSON.stringify({ imports: { '@skmtc/core': 'jsr:@skmtc/core@0.28.0' } })
      }
    },
    async ({ projectPath, denoJson, manager, generator }) => {
      await generator.clone({ denoJson, manager, force: true })

      assertEquals(denoJson.contents.imports?.['@skmtc/core'], 'jsr:@skmtc/core@0.28.0')
      assertEquals(await exists(join(projectPath, 'gen-fixture')), true)
      await manager.cleanup()
    }
  )
})

const onCore = (version: string) =>
  JSON.stringify({ imports: { '@skmtc/core': `jsr:@skmtc/core@${version}` } })

const toPeer = () =>
  Generator.create({
    projectName: 'clone-test',
    scopeName: '@skmtc',
    packageName: 'gen-peer',
    version: '0.3.0'
  })

Deno.test('cloneGenerators - moves two local copies to a new core in one command', async () => {
  // Both local copies are on core 0.28.0; the published versions need 0.29.0.
  await withCloneProject(
    {
      imports: {
        '@skmtc/core': 'jsr:@skmtc/core@0.28.0',
        '@skmtc/gen-fixture': './gen-fixture/mod.ts',
        '@skmtc/gen-peer': './gen-peer/mod.ts'
      },
      files: {
        'gen-fixture/deno.json': onCore('0.28.0'),
        'gen-peer/deno.json': onCore('0.28.0')
      }
    },
    async ({ projectPath, denoJson, manager, generator }) => {
      // The trap #375 fixed: one at a time, each check counts the other's old copy.
      await assertRejects(() => generator.clone({ denoJson, manager }), CoreConflictError)

      const results = await cloneGenerators({
        generators: [generator, toPeer()],
        denoJson,
        manager
      })

      assertEquals(results, [
        { moduleName: '@skmtc/gen-fixture', version: '0.2.8' },
        { moduleName: '@skmtc/gen-peer', version: '0.3.0' }
      ])
      assertEquals(denoJson.contents.imports?.['@skmtc/core'], 'jsr:@skmtc/core@0.29.0')
      assertEquals(await exists(join(projectPath, 'gen-fixture', 'src', 'QueryFn.ts')), true)
      assertEquals(await exists(join(projectPath, 'gen-peer', 'mod.ts')), true)
      await manager.cleanup()
    }
  )
})

Deno.test(
  'cloneGenerators - a generator that stays on another core stops the command before any file is written',
  async () => {
    await withCloneProject(
      {
        imports: {
          '@skmtc/core': 'jsr:@skmtc/core@0.28.0',
          '@skmtc/gen-fixture': './gen-fixture/mod.ts',
          '@skmtc/gen-peer': './gen-peer/mod.ts',
          '@skmtc/gen-typescript': './gen-typescript/mod.ts'
        },
        files: {
          'gen-fixture/deno.json': onCore('0.28.0'),
          'gen-peer/deno.json': onCore('0.28.0'),
          'gen-typescript/deno.json': onCore('0.28.0')
        }
      },
      async ({ projectPath, denoJson, manager, generator }) => {
        const error = await assertRejects(
          () =>
            cloneGenerators({
              generators: [generator, toPeer()],
              denoJson,
              manager
            }),
          CoreConflictError
        )

        // The clones' own old copies are not in the list; the one that stays is.
        assertEquals(error.requirements, [
          {
            generatorId: '@skmtc/gen-typescript',
            range: '0.28.0',
            localPath: './gen-typescript'
          },
          { generatorId: '@skmtc/gen-fixture', range: '0.29.0' },
          { generatorId: '@skmtc/gen-peer', range: '0.29.0' }
        ])
        assertEquals(denoJson.contents.imports?.['@skmtc/core'], 'jsr:@skmtc/core@0.28.0')
        // Neither clone was written, including the first one in the command.
        assertEquals(await exists(join(projectPath, 'gen-fixture', 'mod.ts')), false)
        assertEquals(await exists(join(projectPath, 'gen-peer', 'mod.ts')), false)
        await manager.cleanup()
      }
    )
  }
)

Deno.test('cloneGenerators - a peer named later in the command resolves to its local copy too', async () => {
  // gen-fixture's published deno.json pins jsr:@skmtc/gen-zod. Cloned first,
  // it used to keep that pin while the root pointed gen-zod at ./gen-zod, so
  // the bundle loaded two copies of gen-zod.
  await withCloneProject(
    { imports: { '@skmtc/core': 'jsr:@skmtc/core@0.29.0' } },
    async ({ projectPath, denoJson, manager, generator }) => {
      const zod = Generator.create({
        projectName: 'clone-test',
        scopeName: '@skmtc',
        packageName: 'gen-zod',
        version: '0.2.7'
      })

      await cloneGenerators({ generators: [generator, zod], denoJson, manager })
      await manager.cleanup()

      const fixtureDenoJson = JSON.parse(
        await Deno.readTextFile(join(projectPath, 'gen-fixture', 'deno.json'))
      )
      assertEquals('@skmtc/gen-zod' in fixtureDenoJson.imports, false)
      assertEquals(denoJson.contents.imports?.['@skmtc/gen-zod'], './gen-zod/mod.ts')
    }
  )
})

Deno.test('cloneGenerators - a failed write keeps the clones before it, recorded in the root', async () => {
  // A file where gen-peer's folder would go makes its write fail.
  await withCloneProject(
    {
      imports: {
        '@skmtc/core': 'jsr:@skmtc/core@0.28.0',
        '@skmtc/gen-fixture': './gen-fixture/mod.ts'
      },
      files: { 'gen-fixture/deno.json': onCore('0.28.0'), 'gen-peer': 'not a folder' }
    },
    async ({ projectPath, denoJson, manager, generator }) => {
      await assertRejects(() => cloneGenerators({ generators: [generator, toPeer()], denoJson, manager }))
      // The manager's cleanup is what `Project.cloneGenerators` runs in `finally`.
      await manager.cleanup()

      const root = JSON.parse(await Deno.readTextFile(join(projectPath, 'deno.json')))
      assertEquals(root.imports['@skmtc/core'], 'jsr:@skmtc/core@0.29.0')
      assertEquals(root.imports['@skmtc/gen-fixture'], './gen-fixture/mod.ts')
      assertEquals('@skmtc/gen-peer' in root.imports, false)
      assertEquals(await exists(join(projectPath, 'gen-fixture', 'src', 'QueryFn.ts')), true)
    }
  )
})
