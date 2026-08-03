import { toGeneratorOnlyKey, toRefName } from '@skmtc/core'
import type { Modifiers, SchemaToValueFn, TypeSystemCustom } from '@skmtc/core'
import { EffectArray } from './EffectArray.ts'
import { EffectObject } from './EffectObject.ts'
import { EffectRef } from './EffectRef.ts'
import { EffectUnion } from './EffectUnion.ts'
import {
  EffectBoolean,
  EffectInteger,
  EffectNumber,
  EffectString,
  EffectUnknown,
  EffectVoid
} from './EffectScalars.ts'
import { EffectSchemaBase } from './base.ts'

/**
 * Maps one parsed schema node to its effect Schema snippet. Every branch
 * passes the originating node's `stackTrail` down so attribution can point
 * back at the fragment of the document each snippet came from.
 */
export const toEffectValue: SchemaToValueFn = ({
  context,
  destinationPath,
  schema,
  required,
  rootRef
}) => {
  const modifiers: Modifiers = {
    required,
    nullable: 'nullable' in schema ? schema.nullable : undefined
  }

  const generatorKey = toGeneratorOnlyKey({ generatorId: EffectSchemaBase.id })
  const stackTrail = 'stackTrail' in schema ? schema.stackTrail.clone() : undefined

  switch (schema.type) {
    case 'custom':
      return schema satisfies TypeSystemCustom
    case 'ref':
      return new EffectRef({
        context,
        destinationPath,
        refName: toRefName(schema.$ref),
        modifiers,
        rootRef,
        stackTrail
      })
    case 'array':
      return new EffectArray({
        context,
        destinationPath,
        items: schema.items,
        modifiers,
        generatorKey,
        rootRef,
        stackTrail
      })
    case 'object':
      return new EffectObject({
        context,
        destinationPath,
        objectSchema: schema,
        modifiers,
        generatorKey,
        rootRef
      })
    case 'union':
      return new EffectUnion({
        context,
        destinationPath,
        members: schema.members,
        modifiers,
        generatorKey,
        rootRef,
        stackTrail
      })
    case 'string':
      return new EffectString({
        context,
        destinationPath,
        stringSchema: schema,
        modifiers,
        generatorKey,
        stackTrail
      })
    case 'number':
      return new EffectNumber({ context, destinationPath, modifiers, generatorKey, stackTrail })
    case 'integer':
      return new EffectInteger({ context, destinationPath, modifiers, generatorKey, stackTrail })
    case 'boolean':
      return new EffectBoolean({ context, destinationPath, modifiers, generatorKey, stackTrail })
    case 'unknown':
      return new EffectUnknown({ context, destinationPath, modifiers, generatorKey, stackTrail })
    case 'void':
      return new EffectVoid({ context, destinationPath, modifiers, generatorKey, stackTrail })
    default: {
      const exhaustive: never = schema
      throw new Error(`Unhandled schema type: ${JSON.stringify(exhaustive)}`)
    }
  }
}
