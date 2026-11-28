/**
 * The schema-type router: every schema node dispatches to exactly one
 * snippet class. Every branch returns a snippet OBJECT — text exists
 * only inside toString() bodies. Fine-grained attribution is captured
 * via each snippet's super call (`stackTrail: schema.stackTrail.clone()`).
 */
import { toGeneratorOnlyKey } from '@skmtc/core'
import type { Modifiers, SchemaToValueFn, SchemaType } from '@skmtc/core'
import { myLibEntry } from './mod.ts'
import { MyLibArray } from './MyLibArray.ts'
import { MyLibIntersection } from './MyLibIntersection.ts'
import { MyLibObject } from './MyLibObject.ts'
import { MyLibRef } from './MyLibRef.ts'
import { MyLibString } from './MyLibString.ts'
import { MyLibUnion } from './MyLibUnion.ts'
import {
  MyLibBoolean,
  MyLibInteger,
  MyLibNumber,
  MyLibUnknown,
  MyLibVoid,
} from './MyLibScalars.ts'

export const toMyLibValue: SchemaToValueFn = (
  { schema: schemaNode, destinationPath, required, context },
) => {
  // `schemaNode` arrives typed as the generic `Schema` parameter, and
  // TypeScript does not narrow a type parameter by discriminant.
  // Widening it to the `SchemaType` union lets the switch below narrow
  // each case on its own — generator code narrows, it does not assert.
  const schema: SchemaType = schemaNode

  const modifiers: Modifiers = {
    required,
    nullable: 'nullable' in schema ? schema.nullable : undefined,
  }

  const generatorKey = toGeneratorOnlyKey({ generatorId: myLibEntry.id })

  switch (schema.type) {
    // Custom values pass through untouched — they are already Stringable.
    case 'custom':
      return schema
    case 'ref':
      return new MyLibRef({
        context,
        destinationPath,
        ref: schema,
        modifiers,
      })
    case 'array':
      return new MyLibArray({
        context,
        destinationPath,
        modifiers,
        items: schema.items,
        generatorKey,
        schema,
      })
    case 'object':
      return new MyLibObject({
        context,
        destinationPath,
        objectSchema: schema,
        modifiers,
        generatorKey,
      })
    case 'union':
      return new MyLibUnion({
        context,
        destinationPath,
        members: schema.members,
        discriminator: schema.discriminator,
        modifiers,
        generatorKey,
        schema,
      })
    case 'intersection':
      return new MyLibIntersection({
        context,
        destinationPath,
        intersectionSchema: schema,
        modifiers,
        generatorKey,
      })
    case 'string':
      return new MyLibString({
        context,
        stringSchema: schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    case 'number':
      return new MyLibNumber({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    case 'integer':
      return new MyLibInteger({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    case 'boolean':
      return new MyLibBoolean({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    case 'void':
      return new MyLibVoid({ context, destinationPath, generatorKey })
    case 'unknown':
      return new MyLibUnknown({
        context,
        destinationPath,
        generatorKey,
        schema,
      })
    // A variant that core adds fails to compile here until it has a case.
    default: {
      const _exhaustive: never = schema
      throw new Error(
        `Unhandled schema type: ${Reflect.get(_exhaustive, 'type')}`,
      )
    }
  }
}
