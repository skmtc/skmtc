import { toGeneratorOnlyKey } from '@skmtc/core'
import type { GenerateContextType, OasParameter } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import denoJson from '../deno.json' with { type: 'json' }

type ConstructorArgs = {
  context: GenerateContextType
  parameter: OasParameter
}

export class PathParam extends TsSnippet {
  name: string
  paramType: 'string' | 'number' | 'boolean'

  constructor({ context, parameter }: ConstructorArgs) {
    super({ context, generatorKey: toGeneratorOnlyKey({ generatorId: denoJson.name }) })

    this.name = parameter.name

    const schemaType = parameter.schema?.resolve().type

    this.paramType =
      schemaType === 'number' || schemaType === 'integer'
        ? 'number'
        : schemaType === 'boolean'
          ? 'boolean'
          : 'string'
  }

  override toString(): string {
    return `${this.name}: ${this.paramType}`
  }
}
