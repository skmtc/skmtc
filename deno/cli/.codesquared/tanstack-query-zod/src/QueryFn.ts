import {
  List,
  capitalize,
  decapitalize,
  toPathTemplate,
  Identifier,
  FunctionParameter
} from '@skmtc/core'
import type {
  ListObject,
  OasOperation,
  OperationInsertableArgs,
  RefName
} from '@skmtc/core'
import { type EnrichmentSchema, TanstackQueryBase } from './base.ts'
import { toTsValue } from '@skmtc/typescript'
import { stripLeadingSlash } from './util.ts'
import { ZodInsertable } from '@skmtc/zod'

export class QueryFn extends TanstackQueryBase {
  responseModelZodName: string
  parameter: FunctionParameter
  queryParamArgs: ListObject<string>
  apiPath: string
  constructor({
    context,
    operation,
    settings
  }: OperationInsertableArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    this.queryParamArgs = List.toObject(
      operation.toParams(['query']).map(({ name }) => name)
    )

    const typeDefinition = this.createAndRegisterDefinition({
      schema: operation.toParametersObject(),
      identifier: Identifier.createType(
        `${capitalize(settings.identifier.name)}Args`
      ),
      schemaToValueFn: toTsValue,
      rootRef: 'none' as RefName
    })

    this.parameter = new FunctionParameter({
      typeDefinition,
      destructure: true,
      required: true,
      skipEmpty: true
    })

    const value = operation.toRequestBody(({ schema }) => schema)

    this.responseModelZodName = this.insertModel(
      ZodInsertable,
      value?.isRef() ? value.toRefName() : ('none' as RefName)
    ).toName()

    this.apiPath = stripLeadingSlash(toPathTemplate(this.operation.path))

    this.register({
      imports: {
        '@/lib/querySerialiser': [
          'querySerialiser',
          'defaultQuerySerialiserOptions'
        ]
      }
    })
  }

  static override toIdentifier(operation: OasOperation) {
    const { name } = TanstackQueryBase.toIdentifier(operation)

    return Identifier.createVariable(
      `${decapitalize(name.replace(/^use/, ''))}Fn`
    )
  }

  override toString(): string {
    return `async (${this.parameter}) => {
      const {data, error} = await fetch(\`${
        this.apiPath
      }\${querySerialiser({args:${
      this.queryParamArgs
    }, options: defaultQuerySerialiserOptions })}\`, {
        method: '${this.operation.method.toUpperCase()}'
      })

      if (error) {
        throw error
      }
    
      return ${this.responseModelZodName}.parse(data)
    }`
  }
}
