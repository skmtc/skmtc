import { camelCase } from '@skmtc/core'

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

  const server = `
import { createServer } from 'jsr:@skmtc/server'
${imports}

export default createServer({toGeneratorConfigMap: () => Object.fromEntries([${generators}].map(g => [g.id, g])), logsPath: undefined})`

  return server
}
