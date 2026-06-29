import { assertEquals, assertStringIncludes } from '@std/assert'
import { dirname, fromFileUrl, join, resolve } from '@std/path'

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

// Fixture projects live inside the workspace (under
// `cli/tests/.fixtures/`) so `deno bundle` walks up to
// `skmtc/deno/deno.json` and resolves `@skmtc/core`, `@skmtc/worker`,
// and their sub-paths via the workspace's member packages. No
// reaching outside this repo, no file-path entries in the fixture's
// import map. `.fixtures/` is gitignored — pure throwaway state.
const FIXTURES_DIR = join(TEST_DIR, '.fixtures')

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

// Deliberately no `deno.json` inside the fixture project. Deno
// rejects sub-directory `deno.json` files that aren't declared
// workspace members ("Config file must be a member of the
// workspace"), and the fixture project is ephemeral — adding it to
// `skmtc/deno/deno.json#workspace` would muddy the production layout.
//
// Without a fixture-local config, `deno bundle` walks up from the
// fixture project's `cwd` and finds `skmtc/deno/deno.json` — the
// workspace root — which already resolves `@skmtc/core`,
// `@skmtc/worker`, and their sub-paths via member-package `exports`.

// Minimal inline model generator. Emits one stub TypeScript type per
// registered schema (so the CLI summary reports "Generated N files
// in …"). Lives in the fixture so the smoke test has no dependency
// on the sibling `skmtc-generators` repo.
const FIXTURE_WORKER = `
import toWorker from '@skmtc/worker'
import { toModelEntry } from '@skmtc/core'
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'

const ModelBase = toTsModelProjectionBase({
  id: '@fake/gen-minimal',
  toIdentifierName: ({ refName }) => refName,
  toIdentifierType: () => ({ type: 'type' }),
  toExportPath: ({ refName }) => '@/types/' + refName + '.generated.ts'
})

class FakeProjection extends ModelBase {
  toString() {
    return '{ stub: true }'
  }
}

const fakeGen = toModelEntry({
  id: '@fake/gen-minimal',
  transform: ({ context, refName }) => {
    // deno-lint-ignore no-explicit-any
    context.insertModel(FakeProjection as any, refName)
  }
})

export default toWorker(() => ({ [fakeGen.id]: fakeGen }))
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
 * Build the fixture project under `cli/tests/.fixtures/<unique>/`.
 * Inside the workspace so `deno bundle` finds `skmtc/deno/deno.json`
 * walking up and resolves `@skmtc/*` packages through workspace
 * membership. The `<unique>` segment lets the two smoke tests run
 * without colliding on the same directory.
 */
const setup = async (uniqueSuffix: string): Promise<SetupResult> => {
  const fixtureRoot = join(FIXTURES_DIR, `${PROJECT_NAME}-${uniqueSuffix}`)
  // Wipe any leftover state from a previous interrupted run.
  await Deno.remove(fixtureRoot, { recursive: true }).catch(() => {})

  const projectPath = join(fixtureRoot, '.skmtc', PROJECT_NAME)
  const settingsPath = join(projectPath, '.settings')
  await Deno.mkdir(settingsPath, { recursive: true })

  // No deno.json in the project — workspace root supplies resolution.
  await Deno.writeTextFile(join(projectPath, 'worker.ts'), FIXTURE_WORKER)
  await Deno.writeTextFile(join(settingsPath, 'client.json'), FIXTURE_CLIENT_JSON)

  // Build bundle.js from worker.ts. The cwd is inside the workspace
  // so `deno bundle` finds `skmtc/deno/deno.json` walking up and
  // resolves `@skmtc/*` workspace members via their own `name` +
  // `exports`. No file-path mappings needed.
  const bundleCmd = new Deno.Command('deno', {
    args: ['bundle', '-o', 'bundle.js', 'worker.ts'],
    cwd: projectPath,
    stdout: 'piped',
    stderr: 'piped'
  })
  const bundleOut = await bundleCmd.output()
  if (!bundleOut.success) {
    const err = new TextDecoder().decode(bundleOut.stderr)
    throw new Error(`bundle build failed: ${err}`)
  }

  const schemaPath = join(fixtureRoot, 'schema.graphql')
  await Deno.writeTextFile(schemaPath, FIXTURE_SDL)

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
