import type { ParseContextType } from '@/context/parseTypes.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { isRef } from '@/helpers/refFns.ts'
import { toRefV31 } from '../ref/toRefV31.ts'
import { OasExample } from '@/oas/example/Example.ts'
import type { ExampleFields } from '@/oas/example/Example.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
export type ToExampleSimpleV3Args = {
  example: OpenAPIV3.ExampleObject
  /** The stack trail for tracing */
  stackTrail: StackTrail
  /** Parse context for tracing and error handling */
  context: ParseContextType
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
    value: example.value,
    summary: example.summary,
    description: example.description,
    externalValue: example.externalValue
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
  /** The stack trail for tracing */
  stackTrail: StackTrail
  /** Parse context for tracing and error handling */
  context: ParseContextType
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
  stackTrail,
  context
}: ToExamplesV3Args): Record<string, OasExample | OasRef<'example'>> | undefined => {
  if (example && examples) {
    context.logIssue({
      key: 'example',
      level: 'warning',
      message: `Both example and examples are defined for ${exampleKey}`,
      parent: examples,
      stackTrail,
      type: 'EXAMPLE_AND_EXAMPLES_DEFINED'
    })
  }

  if (example) {
    return {
      [exampleKey]: stackTrail.trace('example', st =>
        toExampleSimpleV3({ example, stackTrail: st, context })
      )
    }
  }

  if (examples) {
    return stackTrail.trace('examples', st => {
      const output: Record<string, OasExample | OasRef<'example'>> = {}
      const entries = Object.entries(examples)

      for (const [key, value] of entries) {
        output[key] = st.trace(key, st2 =>
          toExampleV3({ example: value, stackTrail: st2, context })
        )
      }

      return output
    })
  }

  return undefined
}

export type ToExampleV3Args = {
  example: OpenAPIV3.ExampleObject | OpenAPIV3.ReferenceObject
  stackTrail: StackTrail
  context: ParseContextType
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
  stackTrail,
  context
}: ToExampleV3Args): OasExample | OasRef<'example'> => {
  if (isRef(example)) {
    return toRefV31({ ref: example, refType: 'example', stackTrail, context })
  }

  const { summary, description, value, ...skipped } = example

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: example,
    context,
    stackTrail,
    parentType: 'example'
  })

  return new OasExample({
    summary,
    description,
    value,
    extensionFields
  })
}
