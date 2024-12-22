import { ValueBase } from '../dsl/ValueBase.ts'
import type { GenerateContext } from '../context/GenerateContext.ts'
import type { OasOperation } from '../oas/operation/Operation.ts'
import type { GeneratorKey } from '../types/GeneratorKeys.ts'

type CreateArgs = {
  context: GenerateContext
  generatorKey: GeneratorKey
  operation: OasOperation
  destinationPath: string
}

export class ReactRouterPathParams extends ValueBase {
  getParams: string = ''

  assertParams: string = ''

  passProps: string = ''

  names: string[]

  constructor({ context, operation, generatorKey, destinationPath }: CreateArgs) {
    super({ context, generatorKey })

    const names = operation.toParams(['path']).map(param => param.name)

    this.names = names

    if (names.length > 0) {
      this.getParams = `const { ${names.join(', ')} } = useParams()`
      this.assertParams = names
        .map(param => `invariant(${param}, 'Expected ${param} to be defined')`)
        .join('\n')
      this.passProps = names.map(param => `${param}={${param}}`).join(' ')

      this.register({
        imports: {
          'react-router-dom': ['useParams'],
          'tiny-invariant': [{ default: 'invariant' }]
        },
        destinationPath
      })
    }
  }

  override toString(): string {
    return ``
  }
}
