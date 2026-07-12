import type { ParseContextType } from '@/context/parseTypes.ts'
import { tryParseAt } from '@/context/tryParseAt.ts'
import { isRef } from '@/helpers/refFns.ts'
import {
  oasParameterLocation,
  oasParameterStyle,
  type OasParameterLocation,
  type OasParameterStyle
} from '@/oas/parameter/parameter-types.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toExamplesV3 } from '../example/toExamplesV3.ts'
import { toRefV31 } from '../ref/toRefV31.ts'
import { toOptionalSchemaV3 } from '../schema/toSchemasV3.ts'
import { toOptionalMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.ts'
import { OasParameter } from '@/oas/parameter/Parameter.ts'
import type { ParameterFields } from '@/oas/parameter/Parameter.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import * as v from 'valibot'
import type { StackTrail } from '@/context/StackTrail.ts'
export type ToParameterListV3Args = {
  parameters: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[] | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toParameterListV3 = ({
  parameters,
  stackTrail,
  context
}: ToParameterListV3Args): (OasParameter | OasRef<'parameter'>)[] | undefined => {
  if (!parameters) {
    return undefined
  }

  return parameters.map((parameter, index) => {
    return stackTrail.trace(`${index}`, st => toParameterV3({ parameter, stackTrail: st, context }))
  })
}

export type ToParametersV3Args = {
  parameters: Record<string, OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject>
  stackTrail: StackTrail
  context: ParseContextType
}

export const toParametersV3 = ({
  parameters,
  stackTrail,
  context
}: ToParametersV3Args): Record<string, OasParameter | OasRef<'parameter'>> => {
  const output: Record<string, OasParameter | OasRef<'parameter'>> = {}
  const entries = Object.entries(parameters)
  for (const [key, parameter] of entries) {
    const parsed = tryParseAt({
      stackTrail,
      key,
      context,
      type: 'INVALID_PARAMETER',
      parent: parameter,
      fn: st => toParameterV3({ parameter, stackTrail: st, context })
    })
    if (parsed !== undefined) {
      output[key] = parsed
    }
  }
  return output
}

export type ToOptionalParametersV3Args = {
  parameters: Record<string, OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject> | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toOptionalParametersV3 = ({
  parameters,
  stackTrail,
  context
}: ToOptionalParametersV3Args): Record<string, OasParameter | OasRef<'parameter'>> | undefined => {
  if (!parameters) {
    return undefined
  }

  return toParametersV3({ parameters, stackTrail, context })
}

export type ToParameterV3Args = {
  parameter: OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject
  stackTrail: StackTrail
  context: ParseContextType
}

const toParameterV3 = ({
  parameter,
  stackTrail,
  context
}: ToParameterV3Args): OasParameter | OasRef<'parameter'> => {
  if (isRef(parameter)) {
    return toRefV31({ ref: parameter, refType: 'parameter', stackTrail, context })
  }

  const {
    name,
    in: location,
    description,
    required,
    deprecated,
    allowEmptyValue,
    allowReserved,
    schema,
    example,
    examples,
    content,
    style,
    explode,
    ...skipped
  } = parameter

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: parameter,
    context,
    stackTrail,
    parentType: 'parameter'
  })

  const parsedLocation = v.parse(oasParameterLocation, location)

  if (parsedLocation === 'path' && !required) {
    console.warn(`Path parameters must be required`)
  }

  // Set missing 'required' to true for path parameters and false for others
  const defaultRequired =
    typeof required === 'undefined' ? (parsedLocation === 'path' ? true : false) : required

  const fields: ParameterFields = {
    name,
    location: parsedLocation,
    description,
    required: defaultRequired,
    deprecated,
    style: stackTrail.trace('style', st =>
      toStyle({ style, location: parsedLocation, stackTrail: st })
    ),
    explode: stackTrail.trace('explode', st => toExplode({ explode, style, stackTrail: st })),
    allowEmptyValue,
    allowReserved,
    schema: stackTrail.trace('schema', st =>
      toOptionalSchemaV3({ schema, stackTrail: st, context })
    ),
    examples: stackTrail.trace('examples', st =>
      toExamplesV3({
        examples,
        example,
        exampleKey: `${name}-${parsedLocation}`,
        stackTrail: st,
        context
      })
    ),
    content: stackTrail.trace('content', st =>
      toOptionalMediaTypeItemsV3({ content, stackTrail: st, context })
    ),
    extensionFields
  }

  return context.withStackTrail(stackTrail, () => new OasParameter(fields, context))
}

export type ToStyleArgs = {
  style: string | undefined
  location: OasParameterLocation
  stackTrail: StackTrail
}

const toStyle = ({ style, location, stackTrail }: ToStyleArgs): OasParameterStyle => {
  const parsed = v.parse(v.optional(oasParameterStyle), style)
  if (parsed !== undefined) {
    return parsed
  }

  switch (location) {
    case 'path':
    case 'header':
      return 'simple'
    case 'query':
    case 'cookie':
      return 'form'
    default: {
      const _exhaustive: never = location
      throw new Error(`Unhandled location: ${_exhaustive}`)
    }
  }
}

export type ToExplodeArgs = {
  explode: boolean | undefined
  style: string | undefined
  stackTrail: StackTrail
}

const toExplode = ({ explode, style, stackTrail }: ToExplodeArgs): boolean => {
  if (explode !== undefined) {
    return explode
  }

  switch (style) {
    case 'form':
      return true
    default:
      return false
  }
}
