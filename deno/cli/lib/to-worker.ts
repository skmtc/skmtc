import { camelCase } from '@skmtc/core/strings'

type GeneratorsAcc = {
  imports: string[]
  generators: string[]
}

export const toWorker = (generatorIds: string[]) => {
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

  // Emit a bare specifier for `@skmtc/worker` so the project's import
  // map can route it (e.g. to a local checkout for iteration). When no
  // override is present, Deno still resolves it to the JSR-published
  // package via the project's deno.json import map.
  const server = `
import toWorker from '@skmtc/worker'
${imports}

export default toWorker(() => Object.fromEntries([${generators}].map(g => [g.id, g])))`

  return server
}
