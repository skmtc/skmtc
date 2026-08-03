import type { Modifiers, SchemaToValueFn, SchemaType } from '@skmtc/core'
import { toGeneratorOnlyKey, toRefName } from '@skmtc/core'
import { TypeboxArray } from './TypeboxArray.ts'
import { TypeboxBoolean } from './TypeboxBoolean.ts'
import { TypeboxInteger } from './TypeboxInteger.ts'
import { TypeboxNumber } from './TypeboxNumber.ts'
import { TypeboxObject } from './TypeboxObject.ts'
import { TypeboxRef } from './TypeboxRef.ts'
import { TypeboxString } from './TypeboxString.ts'
import { TypeboxUnion } from './TypeboxUnion.ts'
import { TypeboxUnknown } from './TypeboxUnknown.ts'
import { TypeboxVoid } from './TypeboxVoid.ts'
import { typeboxEntry } from './mod.ts'

/**
 * Maps a parsed schema node to its TypeBox snippet. Every branch returns
 * a snippet instance — the object tree collapses to text only at render.
 */
export const toTypeboxValue: SchemaToValueFn = ({
  schema: schemaNode,
  destinationPath,
  required,
  context,
  rootRef
}) => {
  // Widen the generic parameter to the SchemaType union so the switch can
  // narrow each case on its own.
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
        discriminator: schema.discriminator,
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
