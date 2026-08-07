import { camelCase } from '@skmtc/core/strings'

type GeneratorsAcc = {
  imports: string[]
  generators: string[]
}

export const toServer = (generatorIds: string[]) => {
  const generatorAcc = generatorIds.reduce<GeneratorsAcc>(
    (acc, generatorId) => {
      const name = camelCase(generatorId)

      acc.imports.push(`import ${name} from '${generatorId}'`)
      acc.generators.push(`${name}`)

      return acc
    },
    {
      imports: [],
      generators: []
    }
  )

  const imports = generatorAcc.imports.join('\n')
  const generators = generatorAcc.generators.join(',\n')

  // `@skmtc/server`, NOT `jsr:@skmtc/server`. The bare specifier resolves
  // through the project's import map, where `ensureServerDeps` has pinned an
  // exact version alongside a matching `@skmtc/core` — which is the whole
  // point of that pin. A raw `jsr:` URL bypasses the map and resolves to `*`,
  // so the lockfile decides, and a stale lock silently pulls an older
  // `@skmtc/server` with an older `@skmtc/core` beside the pinned one. Two
  // cores in one bundle means the `GenerateContext` the generators receive is
  // from the wrong copy: every subject fails with `context.<method> is not a
  // function` and the run emits zero artifacts, with nothing naming a version.
  // `server.ts` is emitted beside the project's `deno.json`, so the entry can
  // read its own package identity (name, version, description, homepage) for
  // the server's home page. `toStackIdentity` fails soft — a config without
  // those fields yields the generic page.
  const server = `
import { createServer, toStackIdentity } from '@skmtc/server'
import denoConfig from './deno.json' with { type: 'json' }
${imports}

export default createServer({toGeneratorConfigMap: () => Object.fromEntries([${generators}].map(g => [g.id, g])), logsPath: undefined, identity: toStackIdentity(denoConfig)})`

  return server
}
