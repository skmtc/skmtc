import { toGeneratorOnlyKey, toRefName } from '@skmtc/core'
import type { Modifiers, SchemaToValueFn, SchemaType } from '@skmtc/core'
import { TypeboxArray } from './TypeboxArray.ts'
import { TypeboxObject } from './TypeboxObject.ts'
import { TypeboxRef } from './TypeboxRef.ts'
import { TypeboxUnion } from './TypeboxUnion.ts'
import {
  TypeboxBoolean,
  TypeboxInteger,
  TypeboxNumber,
  TypeboxString,
  TypeboxUnknown,
  TypeboxVoid
} from './primitives.ts'
import denoJson from '../deno.json' with { type: 'json' }

/**
 * Maps a parsed schema node to its TypeBox snippet. Each snippet's super
 * call snapshots the schema's `stackTrail` for fine-grained attribution.
 */
export const toTypeboxValue: SchemaToValueFn = ({ schema: schemaNode, destinationPath, required, context, rootRef }) => {
  // `schemaNode` arrives typed as the generic `Schema` parameter, and
  // TypeScript does not narrow a type parameter by discriminant. Widening it
  // to the `SchemaType` union lets the switch below narrow each case.
  const schema: SchemaType = schemaNode

  const modifiers: Modifiers = {
    required,
    nullable: 'nullable' in schema ? schema.nullable : undefined
  }

  const generatorKey = toGeneratorOnlyKey({ generatorId: denoJson.name })

  switch (schema.type) {
    case 'custom':
      return schema
    case 'ref':
      return new TypeboxRef({
        context,
        destinationPath,
        refName: toRefName(schema.$ref),
        modifiers,
        rootRef,
        schema
      })
    case 'array':
      return new TypeboxArray({
        context,
        destinationPath,
        modifiers,
        items: schema.items,
        generatorKey,
        rootRef,
        schema
      })
    case 'object':
      return new TypeboxObject({
        context,
        destinationPath,
        objectSchema: schema,
        modifiers,
        generatorKey,
        rootRef
      })
    case 'union':
      return new TypeboxUnion({
        context,
        destinationPath,
        members: schema.members,
        discriminator: schema.discriminator,
        modifiers,
        generatorKey,
        rootRef,
        schema
      })
    case 'number':
      return new TypeboxNumber({ context, modifiers, schema, destinationPath, generatorKey })
    case 'integer':
      return new TypeboxInteger({ context, modifiers, schema, destinationPath, generatorKey })
    case 'boolean':
      return new TypeboxBoolean({ context, modifiers, schema, destinationPath, generatorKey })
    case 'string':
      return new TypeboxString({ context, stringSchema: schema, modifiers, destinationPath, generatorKey })
    case 'void':
      return new TypeboxVoid({ context, destinationPath, generatorKey })
    case 'unknown':
      return new TypeboxUnknown({ context, destinationPath, generatorKey, schema })
    default: {
      const _exhaustive: never = schema
      throw new Error(`Unhandled schema type: ${_exhaustive}`)
    }
  }
}
