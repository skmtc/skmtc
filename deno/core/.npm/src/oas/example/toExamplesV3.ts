import type { ParseContext } from '../../context/ParseContext.js'
import type { OpenAPIV3 } from 'openapi-types'
import { isRef } from '../../helpers/refFns.js'
import { toRefV31 } from '../ref/toRefV31.js'
import { OasExample } from './Example.js'
import type { ExampleFields } from './Example.js'
import type { OasRef } from '../ref/Ref.js'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js'

type ToExampleSimpleV3Args = {
  example: unknown
}

export const toExampleSimpleV3 = ({
  example
}: ToExampleSimpleV3Args): OasExample | OasRef<'example'> => {
  const fields: ExampleFields = {
    value: example,
    summary: undefined,
    description: undefined
  }

  return new OasExample(fields)
}

export type ToExamplesV3Args = {
  example: OpenAPIV3.ExampleObject | undefined
  examples: Record<string, OpenAPIV3.ExampleObject | OpenAPIV3.ReferenceObject> | undefined
  exampleKey: string
  context: ParseContext
}

export const toExamplesV3 = ({
  example,
  examples,
  exampleKey,
  context
}: ToExamplesV3Args): Record<string, OasExample | OasRef<'example'>> | undefined => {
  if (example && examples) {
    context.logger.warn(`Both example and examples are defined for ${exampleKey}`)
  }

  if (example) {
    return {
      [exampleKey]: context.trace('example', () => toExampleSimpleV3({ example }))
    }
  }

  if (examples) {
    context.trace('examples', () => {
      return Object.fromEntries(
        Object.entries(examples).map(([key, value]) => {
          return [key, context.trace(key, () => toExampleV3({ example: value, context }))]
        })
      )
    })
  }

  return undefined
}

type ToExampleV3Args = {
  example: OpenAPIV3.ExampleObject | OpenAPIV3.ReferenceObject
  context: ParseContext
}

export const toExampleV3 = ({
  example,
  context
}: ToExampleV3Args): OasExample | OasRef<'example'> => {
  if (isRef(example)) {
    return toRefV31({ ref: example, refType: 'example', context })
  }

  const { summary, description, value, ...skipped } = example

  const extensionFields = toSpecificationExtensionsV3({ skipped, context })

  return new OasExample({
    summary,
    description,
    value,
    extensionFields
  })
}
