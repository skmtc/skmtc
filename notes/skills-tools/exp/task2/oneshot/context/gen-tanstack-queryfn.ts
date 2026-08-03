import { List, toPathTemplate, FunctionParameter, type ListObject } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { capitalize, decapitalize, OasVoid } from 'jsr:@skmtc/core@0.28.3'
import type { OasOperationProjectionConstructorArgs } from 'jsr:@skmtc/core@0.28.3'
import { TanstackQueryBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'
import { TsProjection } from 'jsr:@skmtc/gen-typescript@0.2.5'
import { ZodProjection } from 'jsr:@skmtc/gen-zod@0.2.5'

export class QueryFn extends TanstackQueryBase {
  zodResponseName: string
  parameter: FunctionParameter
  queryParamArgs: ListObject<string>
  constructor({ context, operation, settings }: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    this.queryParamArgs = List.toObject(operation.toParams(['query']).map(({ name }) => name))

    const typeDefinition = this.insertNormalizedModel(TsProjection, {
      schema: operation.toParametersObject(),
      fallbackName: `${capitalize(settings.identifier.name)}Args`
    })

    this.parameter = new FunctionParameter({
      typeDefinition,
      destructure: true,
      required: true,
      skipEmpty: true
    })

    const zodResponse = this.insertNormalizedModel(ZodProjection, {
      schema: operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty(),
      fallbackName: `${decapitalize(settings.identifier.name)}Response`
    })

    this.zodResponseName = zodResponse.identifier.name
  }

  override toString(): string {
    const { path, method } = this.operation

    return `async () => {
      const res = await fetch(\`${toPathTemplate(path)}\`, {
        method: '${method.toUpperCase()}'
      })

      if (!res.ok) {
        const error = await res.text()
        throw new Error(error)
      }
    
      const data = await res.json()

      return ${this.zodResponseName}.parse(data)
    }`
  }
}
