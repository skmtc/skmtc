import { toGeneratorOnlyKey, toRefName } from '@skmtc/core'
import type { Modifiers, SchemaToValueFn, SchemaType } from '@skmtc/core'
import { TypeBoxString } from './TypeBoxString.ts'
import { TypeBoxArray } from './TypeBoxArray.ts'
import { TypeBoxRef } from './TypeBoxRef.ts'
import { TypeBoxObject } from './TypeBoxObject.ts'
import { TypeBoxUnion } from './TypeBoxUnion.ts'
import { TypeBoxNumber } from './TypeBoxNumber.ts'
import { TypeBoxInteger } from './TypeBoxInteger.ts'
import { TypeBoxBoolean } from './TypeBoxBoolean.ts'
import { TypeBoxVoid } from './TypeBoxVoid.ts'
import { TypeBoxUnknown } from './TypeBoxUnknown.ts'
import { typeBoxEntry } from './mod.ts'

/**
 * Maps a parsed schema node to its TypeBox snippet. Fine-grained
 * attribution is captured via each snippet's super call, which snapshots
 * the schema's `stackTrail` — no router-level wrapper.
 */
export const toTypeBoxValue: SchemaToValueFn = ({
  schema: schemaNode,
  destinationPath,
  required,
  context,
  rootRef
}) => {
  // `schemaNode` arrives typed as the generic `Schema` parameter, and
  // TypeScript does not narrow a type parameter by discriminant. Widening
  // it to the `SchemaType` union lets the switch below narrow each case.
  const schema: SchemaType = schemaNode

  const modifiers: Modifiers = {
    required,
    nullable: 'nullable' in schema ? schema.nullable : undefined
  }

  const generatorKey = toGeneratorOnlyKey({ generatorId: typeBoxEntry.id })

  switch (schema.type) {
    case 'custom':
      return schema
    case 'ref':
      return new TypeBoxRef({
        context,
        destinationPath,
        refName: toRefName(schema.$ref),
        modifiers,
        rootRef,
        schema
      })
    case 'array':
      return new TypeBoxArray({
        context,
        destinationPath,
        modifiers,
        items: schema.items,
        generatorKey,
        rootRef,
        schema
      })
    case 'object':
      return new TypeBoxObject({
        context,
        destinationPath,
        objectSchema: schema,
        modifiers,
        generatorKey,
        rootRef
      })
    case 'union':
      return new TypeBoxUnion({
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
      return new TypeBoxNumber({
        context,
        modifiers,
        schema,
        destinationPath,
        generatorKey
      })
    case 'integer':
      return new TypeBoxInteger({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey
      })
    case 'boolean':
      return new TypeBoxBoolean({
        context,
        modifiers,
        schema,
        destinationPath,
        generatorKey
      })
    case 'void':
      return new TypeBoxVoid({ context, destinationPath, generatorKey })
    case 'string':
      return new TypeBoxString({
        context,
        stringSchema: schema,
        modifiers,
        destinationPath,
        generatorKey
      })
    case 'unknown':
      return new TypeBoxUnknown({ context, destinationPath, generatorKey, schema })
    default: {
      const _exhaustive: never = schema
      throw new Error(`Unhandled schema type: ${_exhaustive}`)
    }
  }
}
