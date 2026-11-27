import { assertEquals, assertStringIncludes } from '@std/assert'
import { dirname, fromFileUrl, join, relative, resolve } from '@std/path'

/**
 * End-to-end smoke test for the GraphQL → CLI → output pipeline.
 *
 * Builds a self-contained project in a temp dir (deno.json + worker.ts
 * + bundle.js), drops a fixture `.graphql` schema next to it, and
 * shells out to `cli/mod.ts generate <project> <schema>` via
 * `Deno.Command`. Asserts on stdout: file count, parse-issue
 * formatting, and the precise issue lines that should fire for the
 * fixture schema.
 *
 * Slow (one bundle build per test run, ~1s) but full end-to-end —
 * catches any wire-shape regression in the worker → host channel
 * that unit tests would miss.
 */

const TEST_DIR = dirname(fromFileUrl(import.meta.url))
const CLI_DIR = resolve(TEST_DIR, '..')
const CLI_MOD = join(CLI_DIR, 'mod.ts')
const CLI_DENO_JSON = join(CLI_DIR, 'deno.json')
const WORKSPACE_DIR = resolve(CLI_DIR, '..')

// `.fixtures/` is gitignored — pure throwaway state.
const FIXTURES_DIR = join(TEST_DIR, '.fixtures')

/** The workspace members `skmtc generate` pins in the project, by directory. */
const LINKED_MEMBERS = ['core', 'worker']

const PROJECT_NAME = 'gql-smoke'

const FIXTURE_SDL = /* GraphQL */ `
  directive @auth(role: String!) on FIELD_DEFINITION

  type User {
    id: ID!
    name: String!
    grid: [[Int]]
    posts(limit: Int): [Post!]!
  }

  type Post {
    id: ID!
    title: String!
  }

  type Query {
    me: User
  }
`

/**
 * The fixture project's `deno.json`: only `links` to the workspace
 * members, so the `jsr:` pins `skmtc generate` adds resolve to the
 * workspace code, not to JSR.
 *
 * Deno ignores the parent workspace for a `deno.json` that isn't a
 * member, so once the project has one, the workspace no longer
 * resolves `@skmtc/*` for `deno bundle` or `deno info`.
 */
const toFixtureDenoJson = (projectPath: string): string =>
  JSON.stringify(
    {
      imports: { '@fake/gen-minimal': './gen-minimal/mod.ts' },
      workspace: ['./gen-minimal'],
      links: LINKED_MEMBERS.map(directory =>
        relative(projectPath, join(WORKSPACE_DIR, directory)).replaceAll('\\', '/')
      )
    },
    null,
    2
  )

// Minimal inline model generator. Emits one stub TypeScript type per
// registered schema (so the CLI summary reports "Generated N files
// in …"). Lives in the fixture so the smoke test has no dependency
// on the sibling `skmtc-generators` repo.
const FIXTURE_GENERATOR = `
import { emptyEnrichmentSchema, toModelEntry } from '@skmtc/core'
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'

const ModelBase = toTsModelProjectionBase({
  id: '@fake/gen-minimal',
  toIdentifierName: ({ ref }) => ref.refName,
  toIdentifierType: () => ({ type: 'type' }),
  toExportPath: ({ ref }) => '@/types/' + ref.refName + '.ts',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class FakeProjection extends ModelBase {
  toString() {
    return '{ stub: true }'
  }
}

export default toModelEntry({
  id: '@fake/gen-minimal',
  transform: ({ context, ref }) => {
    // deno-lint-ignore no-explicit-any
    context.insertModel(FakeProjection as any, ref)
  },
  toEnrichmentSchema: () => emptyEnrichmentSchema
})
`

const FIXTURE_CLIENT_JSON = JSON.stringify(
  {
    settings: { basePath: './generated' }
  },
  null,
  2
)

type SetupResult = {
  /** Acts as the SKMTC root for the CLI invocation (contains `.skmtc/`). */
  fixtureRoot: string
  schemaPath: string
}

/**
 * Build the fixture project under `cli/tests/.fixtures/<unique>/`. The
 * `<unique>` segment lets the two smoke tests run without colliding on
 * the same directory.
 */
const setup = async (
  uniqueSuffix: string,
  schema: { fileName: string; contents: string } = {
    fileName: 'schema.graphql',
    contents: FIXTURE_SDL
  }
): Promise<SetupResult> => {
  const fixtureRoot = join(FIXTURES_DIR, `${PROJECT_NAME}-${uniqueSuffix}`)
  // Wipe any leftover state from a previous interrupted run.
  await Deno.remove(fixtureRoot, { recursive: true }).catch(() => {})

  const projectPath = join(fixtureRoot, '.skmtc', PROJECT_NAME)
  const settingsPath = join(projectPath, '.settings')
  await Deno.mkdir(settingsPath, { recursive: true })

  const generatorPath = join(projectPath, 'gen-minimal')
  await Deno.mkdir(generatorPath)
  await Deno.writeTextFile(join(generatorPath, 'mod.ts'), FIXTURE_GENERATOR)
  await Deno.writeTextFile(
    join(generatorPath, 'deno.json'),
    JSON.stringify({ name: '@fake/gen-minimal', version: '0.0.1', exports: './mod.ts' })
  )
  await Deno.writeTextFile(join(settingsPath, 'client.json'), FIXTURE_CLIENT_JSON)
  await Deno.writeTextFile(join(projectPath, 'deno.json'), toFixtureDenoJson(projectPath))

  const schemaPath = join(fixtureRoot, schema.fileName)
  await Deno.writeTextFile(schemaPath, schema.contents)

  return { fixtureRoot, schemaPath }
}

const teardown = async (fixtureRoot: string): Promise<void> => {
  await Deno.remove(fixtureRoot, { recursive: true }).catch(() => {})
}

Deno.test({
  name: 'CLI smoke - graphql schema generates files and surfaces parseIssues',
  // Bundle build + worker spawn dominate the time; allow generous slack.
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { fixtureRoot, schemaPath } = await setup('issues')
    try {
      const cmd = new Deno.Command(Deno.execPath(), {
        args: [
          'run',
          '--allow-all',
          '--config',
          CLI_DENO_JSON,
          CLI_MOD,
          'generate',
          PROJECT_NAME,
          schemaPath
        ],
        cwd: fixtureRoot,
        stdout: 'piped',
        stderr: 'piped'
      })
      const { success, stdout, stderr } = await cmd.output()

      const out = new TextDecoder().decode(stdout)
      const err = new TextDecoder().decode(stderr)

      if (!success) {
        throw new Error(`CLI failed.\nstdout:\n${out}\nstderr:\n${err}`)
      }

      // Top-line generation summary present. The CLI emits
      // "Generated N tokens, M files under <basePath> in <ms>." —
      // assert on the stable anchors of that sentence.
      assertStringIncludes(out, 'Generated')
      assertStringIncludes(out, 'files under')

      // The file is named by the model's `ref.refName`.
      const generated = join(fixtureRoot, 'generated', 'types', 'User.generated.ts')
      await Deno.stat(generated)

      // The fixture schema has 3 distinct issue categories — one of each
      // exercises a different code path in GqlParseContext.
      assertStringIncludes(out, 'Parse issues')
      assertStringIncludes(out, 'DROPPED_DIRECTIVE')
      assertStringIncludes(out, 'NESTED_LIST_LOSSY')
      assertStringIncludes(out, 'SKIPPED_FIELD_ARGUMENTS')

      // Specific locations the parser should attribute issues to.
      // StackTrail locations use `:` as the segment separator on the
      // wire, so `User:grid` and `User:posts:limit` are the forms
      // that appear in the CLI's printed parse-issue list.
      assertStringIncludes(out, '@auth')
      assertStringIncludes(out, 'User:grid')
      assertStringIncludes(out, 'User:posts:limit')
    } finally {
      await teardown(fixtureRoot)
    }
  }
})

Deno.test({
  name: 'CLI smoke - clean graphql schema produces no parse issues',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { fixtureRoot, schemaPath } = await setup('clean')
    try {
      // Overwrite with a clean schema (no directives, no nested lists,
      // no non-root field args).
      await Deno.writeTextFile(
        schemaPath,
        /* GraphQL */ `
          type User {
            id: ID!
            name: String!
          }
          type Query {
            me: User!
          }
        `
      )

      const cmd = new Deno.Command(Deno.execPath(), {
        args: [
          'run',
          '--allow-all',
          '--config',
          CLI_DENO_JSON,
          CLI_MOD,
          'generate',
          PROJECT_NAME,
          schemaPath
        ],
        cwd: fixtureRoot,
        stdout: 'piped',
        stderr: 'piped'
      })
      const { success, stdout, stderr } = await cmd.output()

      const out = new TextDecoder().decode(stdout)
      const err = new TextDecoder().decode(stderr)

      if (!success) {
        throw new Error(`CLI failed.\nstdout:\n${out}\nstderr:\n${err}`)
      }

      assertStringIncludes(out, 'Generated')
      // The "Parse issues" section should NOT appear for a clean schema.
      assertEquals(out.includes('Parse issues'), false)
    } finally {
      await teardown(fixtureRoot)
    }
  }
})

/**
 * An OpenAPI document with one parse warning: a property OpenAPI does not
 * define on a schema (`UNEXPECTED_PROPERTY`).
 */
const WARNING_SCHEMA = {
  fileName: 'schema.json',
  contents: JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'Parse warning', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {
        User: {
          type: 'object',
          notAKeyword: true,
          properties: { name: { type: 'string' } }
        }
      }
    }
  })
}

const runGenerate = async (
  fixtureRoot: string,
  schemaPath: string,
  extraArgs: string[]
): Promise<{ out: string; err: string }> => {
  const { success, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
    args: [
      'run',
      '--allow-all',
      '--config',
      CLI_DENO_JSON,
      CLI_MOD,
      'generate',
      PROJECT_NAME,
      schemaPath,
      ...extraArgs
    ],
    cwd: fixtureRoot,
    stdout: 'piped',
    stderr: 'piped'
  }).output()

  const out = new TextDecoder().decode(stdout)
  const err = new TextDecoder().decode(stderr)

  if (!success) {
    throw new Error(`CLI failed.\nstdout:\n${out}\nstderr:\n${err}`)
  }

  return { out, err }
}

Deno.test({
  name: 'CLI smoke - generate --json with a parse warning writes only JSON to stdout',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { fixtureRoot, schemaPath } = await setup('json-warning', WARNING_SCHEMA)
    try {
      const { out, err } = await runGenerate(fixtureRoot, schemaPath, ['--json'])

      // All of stdout is one JSON object.
      const result: unknown = JSON.parse(out)
      assertStringIncludes(JSON.stringify(result), '"level":"warning"')

      // The run's log lines go to stderr.
      assertStringIncludes(err, '[WARN]')
    } finally {
      await teardown(fixtureRoot)
    }
  }
})

Deno.test({
  name: 'CLI smoke - generate in text mode writes parse warnings to stderr',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { fixtureRoot, schemaPath } = await setup('text-warning', WARNING_SCHEMA)
    try {
      const { out, err } = await runGenerate(fixtureRoot, schemaPath, [])

      assertStringIncludes(out, 'Generated')
      assertStringIncludes(err, '[WARN]')
      assertEquals(out.includes('[WARN]'), false)
    } finally {
      await teardown(fixtureRoot)
    }
  }
})
