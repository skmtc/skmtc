import type { ParseContextType } from '@/context/parseTypes.ts'
import { isRef } from '../../helpers/refFns.ts'
import {
  oasParameterLocation,
  oasParameterStyle,
  type OasParameterLocation,
  type OasParameterStyle
} from './parameter-types.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toExamplesV3 } from '../example/toExamplesV3.ts'
import { toRefV31 } from '../ref/toRefV31.ts'
import { toOptionalSchemaV3 } from '../schema/toSchemasV3.ts'
import { toOptionalMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.ts'
import { OasParameter } from './Parameter.ts'
import type { ParameterFields } from './Parameter.ts'
import type { OasRef } from '../ref/Ref.ts'
import { match } from 'npm:ts-pattern@^5.8.0'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import * as v from 'valibot'
import invariant from 'tiny-invariant'
import type { StackTrail } from '@/context/StackTrail.ts'
type ToParameterListV3Args = {
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

type ToParametersV3Args = {
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
    try {
      output[key] = stackTrail.trace(key, st =>
        toParameterV3({ parameter, stackTrail: st, context })
      )
    } catch (error) {
      invariant(error instanceof Error, 'Invalid error')

      context.logIssue({
        key,
        level: 'error',
        error,
        parent: parameter,
        stackTrail,
        type: 'INVALID_PARAMETER'
      })
    }
  }
  return output
}

type ToOptionalParametersV3Args = {
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

type ToParameterV3Args = {
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

  return new OasParameter(fields)
}

type ToStyleArgs = {
  style: string | undefined
  location: OasParameterLocation
  stackTrail: StackTrail
}

const toStyle = ({ style, location, stackTrail }: ToStyleArgs): OasParameterStyle => {
  const parsed = v.parse(v.optional(oasParameterStyle), style)
  return (
    parsed ??
    match(location)
      .with('path', () => 'simple' as const)

      .with('header', () => 'simple' as const)
      .with('query', () => 'form' as const)
      .with('cookie', () => 'form' as const)
      .exhaustive()
  )
}

type ToExplodeArgs = {
  explode: boolean | undefined
  style: string | undefined
  stackTrail: StackTrail
}

const toExplode = ({ explode, style, stackTrail }: ToExplodeArgs): boolean => {
  return (
    explode ??
    match(style)
      .with('form', () => true)
      .otherwise(() => false)
  )
}
