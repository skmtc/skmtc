import type { ParseContext } from '../../context/ParseContext.ts'
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
import { match } from 'npm:ts-pattern@5.6.0'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import * as v from 'valibot'
import invariant from 'tiny-invariant'

type ToParameterListV3Args = {
  parameters: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[] | undefined
  context: ParseContext
}

export const toParameterListV3 = ({
  parameters,
  context
}: ToParameterListV3Args): (OasParameter | OasRef<'parameter'>)[] | undefined => {
  if (!parameters) {
    return undefined
  }

  return parameters.map((parameter, index) => {
    return context.trace(`${index}`, () => toParameterV3({ parameter, context }))
  })
}

type ToParametersV3Args = {
  parameters: Record<string, OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject>
  context: ParseContext
}

export const toParametersV3 = ({
  parameters,
  context
}: ToParametersV3Args): Record<string, OasParameter | OasRef<'parameter'>> => {
  return Object.fromEntries(
    Object.entries(parameters).map(([key, parameter]) => {
      try {
        return [key, context.trace(key, () => toParameterV3({ parameter, context }))]
      } catch (error: unknown) {
        invariant(error instanceof Error, 'Invalid error')

        context.logIssue({
          key: key,
          level: 'error',
          error,
          parent: parameter,
          type: 'INVALID_PARAMETER'
        })

        return []
      }
    })
  )
}

type ToOptionalParametersV3Args = {
  parameters: Record<string, OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject> | undefined
  context: ParseContext
}

export const toOptionalParametersV3 = ({
  parameters,
  context
}: ToOptionalParametersV3Args): Record<string, OasParameter | OasRef<'parameter'>> | undefined => {
  if (!parameters) {
    return undefined
  }

  return toParametersV3({ parameters, context })
}

type ToParameterV3Args = {
  parameter: OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject
  context: ParseContext
}

const toParameterV3 = ({
  parameter,
  context
}: ToParameterV3Args): OasParameter | OasRef<'parameter'> => {
  if (isRef(parameter)) {
    return toRefV31({ ref: parameter, refType: 'parameter', context })
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
    style: context.trace('style', () => toStyle({ style, location: parsedLocation })),
    explode: context.trace('explode', () => toExplode({ explode, style })),
    allowEmptyValue,
    allowReserved,
    schema: context.trace('schema', () => toOptionalSchemaV3({ schema, context })),
    examples: context.trace('examples', () =>
      toExamplesV3({
        examples,
        example,
        exampleKey: `${name}-${parsedLocation}`,
        context
      })
    ),
    content: context.trace('content', () => toOptionalMediaTypeItemsV3({ content, context })),
    extensionFields
  }

  return new OasParameter(fields)
}

type ToStyleArgs = {
  style: string | undefined
  location: OasParameterLocation
}

const toStyle = ({ style, location }: ToStyleArgs): OasParameterStyle => {
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
}

const toExplode = ({ explode, style }: ToExplodeArgs): boolean => {
  return (
    explode ??
    match(style)
      .with('form', () => true)
      .otherwise(() => false)
  )
}
