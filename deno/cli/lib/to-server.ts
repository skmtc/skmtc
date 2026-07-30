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
  const server = `
import { createServer } from '@skmtc/server'
${imports}

export default createServer({toGeneratorConfigMap: () => Object.fromEntries([${generators}].map(g => [g.id, g])), logsPath: undefined})`

  return server
}
