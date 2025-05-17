// @deno-types="npm:@types/babel__helper-validator-identifier@7.15.2"
import { isIdentifierName } from 'npm:@babel/helper-validator-identifier@7.22.20'
import {
  capitalize,
  decapitalize,
  handleKey,
  List,
  Identifier,
  FunctionParameter,
  toPathTemplate
} from '@skmtc/core'
import type {
  OasOperation,
  OperationInsertableArgs,
  ListObject,
  Stringable,
  RefName
} from '@skmtc/core'
import { toTsValue } from '@skmtc/typescript'
import { type EnrichmentSchema, TanstackQueryBase } from './base.ts'
import { camelCase } from 'lodash-es'
import { stripLeadingSlash } from './util.ts'
import { ZodInsertable } from '@skmtc/zod'

export class MutationFn extends TanstackQueryBase {
  parameter: FunctionParameter
  responseModelZodName: string
  queryParamArgs: ListObject<string>
  headerParams: ListObject<Stringable>
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

    const headerParams = operation.toParametersObject(['header'])

    this.headerParams = List.fromKeys(headerParams.properties ?? {}).toObject(
      (key) => {
        return isIdentifierName(key)
          ? key
          : List.toKeyValue(handleKey(key), camelCase(key))
      }
    )

    const parametersObject = operation.toParametersObject()

    const parametersWithBody = operation.toRequestBody(({ schema }) => {
      return parametersObject.addProperty({
        name: 'body',
        schema,
        required: true
      })
    })

    const typeDefinition = this.createAndRegisterDefinition({
      schema: parametersWithBody ?? parametersObject,
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

  static override toIdentifier(operation: OasOperation): Identifier {
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
        method: '${this.operation.method.toUpperCase()}',
        ${this.parameter.hasProperty('body') ? 'body,' : ''}
      })

      if (error) {
        throw await error.context.json()
      }
    
      return ${this.responseModelZodName}.parse(data)
    }`
  }
}
