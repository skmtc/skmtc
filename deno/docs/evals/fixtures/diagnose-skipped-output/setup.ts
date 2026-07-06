/** Fixture: a working SKMTC project where `client.json#settings.skip`
 * silences @skmtc/gen-typescript — `generate` succeeds but emits no
 * type files.
 *
 * The generator is VENDORED from the workspace source
 * (skmtc-generators/gen-typescript) as a local generator rather than
 * installed from a registry: as of 2026-07-05 no registry serves a
 * version-consistent gen-typescript install (jsr.io's is ancient,
 * the mirror's pins a stale core → dual-core-copy → silently empty
 * artifacts; see the plan's "Environment discoveries"). The vendored
 * source pins core 0.24.0 + lang-typescript 0.12.9, which unify with
 * the jsr.io worker 0.3.44 pin — a single core copy.
 *
 * Self-verification: proves the HEALTHY state first (generate emits
 * non-empty types), then plants the fault and proves the BROKEN
 * state (generate exits 0, no output). A fixture that only plants
 * the fault could hand the agent an unsolvable environment.
 *
 * Requires: skmtc on PATH resolving against jsr.io (run with JSR_URL
 * unset — the harness strips it), deno, and the skmtc-generators
 * checkout as a sibling of the skmtc repo.
 */

import { dirname, fromFileUrl, join } from 'jsr:@std/path@^1'
import { copy } from 'jsr:@std/fs@^1'

const sandbox = Deno.args[0]
if (!sandbox) {
  console.error('usage: deno run -A setup.ts <sandboxDir>')
  Deno.exit(2)
}

const fixtureDir = dirname(fromFileUrl(import.meta.url))
const workspaceRoot = join(fixtureDir, '..', '..', '..', '..', '..', '..')
const genTypescriptSource = join(workspaceRoot, 'skmtc-generators', 'gen-typescript')

try {
  await Deno.stat(join(genTypescriptSource, 'deno.json'))
} catch {
  console.error(`gen-typescript source not found at ${genTypescriptSource}`)
  Deno.exit(2)
}

const run = async (cmd: string, args: string[]): Promise<string> => {
  const output = await new Deno.Command(cmd, {
    args,
    cwd: sandbox,
    stdout: 'piped',
    stderr: 'piped'
  }).output()
  const stdout = new TextDecoder().decode(output.stdout)
  if (!output.success) {
    throw new Error(
      `${cmd} ${args.join(' ')} exited ${output.code}: ${new TextDecoder().decode(output.stderr)} ${stdout}`
    )
  }
  return stdout
}

const schema = {
  openapi: '3.0.3',
  info: { title: 'Petstore Lite', version: '1.0.0' },
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        responses: {
          '200': {
            description: 'A list of pets',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Pet' }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      Pet: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'integer', format: 'int64' },
          name: { type: 'string' },
          tag: { type: 'string' },
          status: { type: 'string', enum: ['available', 'pending', 'sold'] }
        }
      },
      Order: {
        type: 'object',
        required: ['id', 'petId', 'quantity'],
        properties: {
          id: { type: 'integer', format: 'int64' },
          petId: { type: 'integer', format: 'int64' },
          quantity: { type: 'integer' },
          shipDate: { type: 'string', format: 'date-time' }
        }
      }
    }
  }
}

await Deno.writeTextFile(join(sandbox, 'schema.json'), JSON.stringify(schema, null, 2))

await run('skmtc', ['init', 'lab', 'app/src', '--json'])

// Vendor the generator as a local workspace member (the CLI discovers
// it via the gen-* import key in the project deno.json).
const projectDir = join(sandbox, '.skmtc', 'lab')
await copy(genTypescriptSource, join(projectDir, 'gen-typescript'), { overwrite: true })

// Rewrite the member's imports for the sandbox world:
// 1. Pin the bare specifiers its source imports (@std/path,
//    ts-pattern) — in skmtc-generators the ROOT deno.json supplies
//    them; standalone, the member must.
// 2. Re-pin core + lang-typescript to the mirror-consistent line
//    (core 0.23.2 — what the sandbox CLI's worker pin and
//    lang-typescript 0.12.8 both resolve to), so the runtime holds a
//    SINGLE core copy. The source's own pins (core 0.24.0) belong to
//    the jsr.io line, which deno bundle currently can't load from.
const genDenoJsonPath = join(projectDir, 'gen-typescript', 'deno.json')
const genDenoJson: unknown = JSON.parse(await Deno.readTextFile(genDenoJsonPath))
if (typeof genDenoJson !== 'object' || genDenoJson === null || Array.isArray(genDenoJson)) {
  throw new Error('gen-typescript deno.json did not parse to an object')
}
const genRecord: Record<string, unknown> = { ...genDenoJson }
const genImports = genRecord.imports
genRecord.imports = {
  ...(typeof genImports === 'object' && genImports !== null ? genImports : {}),
  '@skmtc/core': 'jsr:@skmtc/core@0.23.2',
  '@skmtc/lang-typescript': 'jsr:@skmtc/lang-typescript@0.12.8',
  '@std/path': 'jsr:@std/path@^1.1.2',
  'ts-pattern': 'npm:ts-pattern@^5.8.0'
}
await Deno.writeTextFile(genDenoJsonPath, JSON.stringify(genRecord, null, 2))

const projectDenoJsonPath = join(projectDir, 'deno.json')
const projectDenoJson: unknown = JSON.parse(await Deno.readTextFile(projectDenoJsonPath))
if (
  typeof projectDenoJson !== 'object' ||
  projectDenoJson === null ||
  Array.isArray(projectDenoJson)
) {
  throw new Error('project deno.json did not parse to an object')
}
const projectRecord: Record<string, unknown> = { ...projectDenoJson }
const existingImports = projectRecord.imports
projectRecord.imports = {
  ...(typeof existingImports === 'object' && existingImports !== null ? existingImports : {}),
  '@skmtc/gen-typescript': './gen-typescript/mod.ts'
}
projectRecord.workspace = ['./gen-typescript']
await Deno.writeTextFile(projectDenoJsonPath, JSON.stringify(projectRecord, null, 2))

// bundle regenerates worker.ts from the imports and adds the
// @skmtc/core + @skmtc/worker pins at the CLI's own versions.
await run('skmtc', ['bundle', 'lab', '--json'])

// Pin the schema source.
const clientJsonPath = join(projectDir, '.settings', 'client.json')
const readClientJson = async (): Promise<Record<string, unknown>> => {
  const parsed: unknown = JSON.parse(await Deno.readTextFile(clientJsonPath))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('client.json did not parse to an object')
  }
  return { ...parsed }
}
const readSettings = (clientRecord: Record<string, unknown>): Record<string, unknown> => {
  const settings = clientRecord.settings
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    throw new Error('client.json#settings is not an object')
  }
  return { ...settings }
}

const healthyClient = await readClientJson()
healthyClient.source = join(sandbox, 'schema.json')
await Deno.writeTextFile(clientJsonPath, JSON.stringify(healthyClient, null, 2))

// Prove the HEALTHY state: generate emits a non-empty Pet type.
await run('skmtc', ['generate', 'lab', '--json'])
const petPath = join(sandbox, 'app', 'src', 'types', 'pet.generated.ts')
const petContent = await Deno.readTextFile(petPath)
if (!petContent.includes('Pet')) {
  throw new Error(`fixture invalid: healthy generate produced unusable output: '${petContent.slice(0, 120)}'`)
}

// Plant the fault and reset the output tree.
// NOTE: a subtler include-allow-list fault (refName that matches
// nothing) was tried and does NOT take on this stack — core 0.23.2
// predates per-model include enforcement, so the entry is ignored
// and output still generates. Until the registries converge on a
// current core, the fault is a bare whole-generator `skip`, which
// the no-docs control also solves — this task currently validates
// harness plumbing more than docs quality (see checklist).
const brokenClient = await readClientJson()
brokenClient.settings = { ...readSettings(brokenClient), skip: ['@skmtc/gen-typescript'] }
await Deno.writeTextFile(clientJsonPath, JSON.stringify(brokenClient, null, 2))

await run('skmtc', ['clean', 'lab', '--json'])
await run('skmtc', ['generate', 'lab', '--json'])

// Prove the BROKEN state: generate succeeded, no output.
try {
  await Deno.stat(join(sandbox, 'app', 'src', 'types'))
  throw new Error('fixture invalid: app/src/types exists — the skip filter did not take')
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error
}

console.log('fixture ready: healthy state proven, fault planted, broken state proven')
