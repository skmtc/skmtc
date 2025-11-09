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

  const server = `
import toWorker from 'jsr:@skmtc/worker'
${imports}

export default toWorker(() => Object.fromEntries([${generators}].map(g => [g.id, g])))`

  return server
}
