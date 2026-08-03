import { TypeboxString } from './TypeboxString.ts'
import { TypeboxArray } from './TypeboxArray.ts'
import { TypeboxRef } from './TypeboxRef.ts'
import { TypeboxObject } from './TypeboxObject.ts'
import { TypeboxUnion } from './TypeboxUnion.ts'
import type { Modifiers, SchemaToValueFn, SchemaType } from '@skmtc/core'
import { TypeboxNumber } from './TypeboxNumber.ts'
import { TypeboxInteger } from './TypeboxInteger.ts'
import { TypeboxBoolean } from './TypeboxBoolean.ts'
import { TypeboxVoid } from './TypeboxVoid.ts'
import { TypeboxUnknown } from './TypeboxUnknown.ts'
import { toGeneratorOnlyKey, toRefName } from '@skmtc/core'
import { typeboxEntry } from './mod.ts'

/**
 * Maps a parsed schema node to its TypeBox snippet. Fine-grained
 * attribution is captured via each snippet's super call, which snapshots
 * the schema's `stackTrail` — no router-level wrapper.
 */
export const toTypeboxValue: SchemaToValueFn = ({
  schema: schemaNode,
  destinationPath,
  required,
  context,
  rootRef
}) => {
  // `schemaNode` arrives typed as the generic `Schema` parameter, and
  // TypeScript does not narrow a type parameter by discriminant. Widening it
  // to the `SchemaType` union lets the switch below narrow each case.
  const schema: SchemaType = schemaNode

  const modifiers: Modifiers = {
    required,
    nullable: 'nullable' in schema ? schema.nullable : undefined
  }

  const generatorKey = toGeneratorOnlyKey({ generatorId: typeboxEntry.id })

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
        modifiers,
        generatorKey,
        rootRef,
        schema
      })
    case 'number':
      return new TypeboxNumber({
        context,
        modifiers,
        schema,
        destinationPath,
        generatorKey
      })
    case 'integer':
      return new TypeboxInteger({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey
      })
    case 'boolean':
      return new TypeboxBoolean({
        context,
        modifiers,
        schema,
        destinationPath,
        generatorKey
      })
    case 'void':
      return new TypeboxVoid({ context, destinationPath, generatorKey })
    case 'string':
      return new TypeboxString({
        context,
        stringSchema: schema,
        modifiers,
        destinationPath,
        generatorKey
      })
    case 'unknown':
      return new TypeboxUnknown({ context, destinationPath, generatorKey, schema })
    default: {
      const _exhaustive: never = schema
      throw new Error(`Unhandled schema type: ${_exhaustive}`)
    }
  }
}
