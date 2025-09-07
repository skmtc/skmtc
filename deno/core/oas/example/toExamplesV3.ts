import type { ParseContext } from '../../context/ParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { isRef } from '../../helpers/refFns.ts'
import { toRefV31 } from '../ref/toRefV31.ts'
import { OasExample } from './Example.ts'
import type { ExampleFields } from './Example.ts'
import type { OasRef } from '../ref/Ref.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToExampleSimpleV3Args = {
  example: unknown
}

/**
 * Creates a simple OAS example from a value.
 * 
 * Converts a raw example value into an OasExample object with basic
 * fields. Used for simple example scenarios where only the value matters.
 * 
 * @param args - Arguments containing the example value
 * @returns OasExample object with the provided value
 */
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

/**
 * Arguments for processing OpenAPI v3 examples into OAS example objects.
 * 
 * Handles both single example and examples collection scenarios,
 * with context for tracing and error handling.
 */
export type ToExamplesV3Args = {
  /** Single example object (OpenAPI v3 format) */
  example: OpenAPIV3.ExampleObject | undefined
  /** Collection of named examples (OpenAPI v3 format) */
  examples: Record<string, OpenAPIV3.ExampleObject | OpenAPIV3.ReferenceObject> | undefined
  /** Key name for the example context */
  exampleKey: string
  /** Parse context for tracing and error handling */
  context: ParseContext
}

/**
 * Processes OpenAPI v3 examples into OAS example objects.
 * 
 * Handles both single example and examples collection scenarios,
 * converting them to the internal OAS representation. Provides
 * warnings when both formats are specified simultaneously.
 * 
 * @param args - Arguments containing example data and context
 * @returns Record of processed examples, or undefined if no examples
 */
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

/**
 * Processes a single OpenAPI v3 example into an OAS example object.
 * 
 * Converts OpenAPI v3 example objects or references into the internal
 * OAS representation, handling both direct examples and $ref references.
 * Processes specification extensions and maintains all example metadata.
 * 
 * @param args - Arguments containing the example and parsing context
 * @returns OasExample object or reference to an example
 */
export const toExampleV3 = ({
  example,
  context
}: ToExampleV3Args): OasExample | OasRef<'example'> => {
  if (isRef(example)) {
    return toRefV31({ ref: example, refType: 'example', context })
  }

  const { summary, description, value, ...skipped } = example

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: example,
    context,
    parentType: 'example'
  })

  return new OasExample({
    summary,
    description,
    value,
    extensionFields
  })
}
