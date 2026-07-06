/** Fixture: an initialized, empty SKMTC project + a small OpenAPI
 * schema. The eval agent must author a local model generator from
 * scratch (the docs under test describe the wiring and the DSL).
 *
 * The environment facts the agent cannot derive from docs — which
 * registry versions are mutually consistent — are stated in the task
 * prompt (core 0.23.2 / lang-typescript 0.12.8; see the plan's
 * "Environment discoveries" for why).
 *
 * Requires: skmtc on PATH (the harness provides the sandbox shim).
 */

import { join } from 'jsr:@std/path@^1'

const sandbox = Deno.args[0]
if (!sandbox) {
  console.error('usage: deno run -A setup.ts <sandboxDir>')
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
          tag: { type: 'string' }
        }
      },
      Order: {
        type: 'object',
        required: ['id', 'petId', 'quantity'],
        properties: {
          id: { type: 'integer', format: 'int64' },
          petId: { type: 'integer', format: 'int64' },
          quantity: { type: 'integer' }
        }
      }
    }
  }
}

await Deno.writeTextFile(join(sandbox, 'schema.json'), JSON.stringify(schema, null, 2))

await run('skmtc', ['init', 'lab', 'app/src', '--json'])

// Pin the schema source so `skmtc generate lab` needs no positional.
const clientJsonPath = join(sandbox, '.skmtc', 'lab', '.settings', 'client.json')
const clientJson: unknown = JSON.parse(await Deno.readTextFile(clientJsonPath))
if (typeof clientJson !== 'object' || clientJson === null || Array.isArray(clientJson)) {
  throw new Error('client.json did not parse to an object')
}
const clientRecord: Record<string, unknown> = { ...clientJson }
clientRecord.source = join(sandbox, 'schema.json')
await Deno.writeTextFile(clientJsonPath, JSON.stringify(clientRecord, null, 2))

console.log('fixture ready: empty project initialized, schema pinned')
