import { camelCase } from '@skmtc/core/strings'
import type { WorkerModule } from '@/lib/stack-core.ts'

type GeneratorsAcc = {
  imports: string[]
  generators: string[]
}

type ToWorkerArgs = {
  generatorIds: string[]
  /** Where `toWorker` comes from: the project's core, or `@skmtc/worker` for an older core. */
  workerModule: WorkerModule
}

export const toWorker = ({ generatorIds, workerModule }: ToWorkerArgs) => {
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

  // Emit bare specifiers so the project's import map routes them (e.g. to
  // a local checkout for iteration).
  //
  // `import '@skmtc/core'` puts the project's exact core pin into the
  // graph first, so ranged dependencies settle on it rather than on the
  // newest core. With `@skmtc/core/worker`, the worker entry is part of
  // that same core, so the core that runs is the one the stack pins (#333).
  const server = `
import '@skmtc/core'
import toWorker from '${workerModule}'
${imports}

export default toWorker(() => Object.fromEntries([${generators}].map(g => [g.id, g])))`

  return server
}
