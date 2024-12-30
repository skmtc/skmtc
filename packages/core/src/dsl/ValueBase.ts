import type { GenerateContext } from '../context/GenerateContext.js'
import type { RegisterArgs } from '../context/GenerateContext.js'
import type { GeneratorKey } from '../types/GeneratorKeys.js'

type ValueBaseArgs = {
  context: GenerateContext
  generatorKey?: GeneratorKey
}

export class ValueBase {
  context: GenerateContext
  skipped: boolean = false
  generatorKey: GeneratorKey | undefined

  constructor({ context, generatorKey }: ValueBaseArgs) {
    this.context = context
    this.generatorKey = generatorKey

    return new Proxy(this, proxyHandler)
  }

  register(args: RegisterArgs) {
    this.context.register(args)
  }
}

const proxyHandler: ProxyHandler<ValueBase> = {
  get: (target, propertyName) => {
    return propertyName === 'toString'
      ? new Proxy(target[propertyName], {
          apply: (toString, thisArg) => {
            if (target.generatorKey) {
              target.context.callback(target.generatorKey)
            }

            return toString.apply(thisArg)
          }
        })
      : target[propertyName as keyof ValueBase]
  }
}
