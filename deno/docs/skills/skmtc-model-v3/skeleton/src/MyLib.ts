/**
 * The schema-type router: every schema node dispatches to exactly one
 * snippet class. Every branch returns a snippet OBJECT — text exists
 * only inside toString() bodies. Fine-grained attribution is captured
 * via each snippet's super call (`stackTrail: schema.stackTrail.clone()`).
 */
import { toGeneratorOnlyKey, toRefName } from '@skmtc/core'
import type { Modifiers, SchemaToValueFn, SchemaType } from '@skmtc/core'
import { match } from 'ts-pattern'
import { myLibEntry } from './mod.ts'
import { MyLibArray } from './MyLibArray.ts'
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
  { schema: schemaNode, destinationPath, required, context, rootRef },
) => {
  // `schemaNode` arrives typed as the generic `Schema` parameter, and
  // TypeScript does not narrow a type parameter by discriminant.
  // Widening it to the `SchemaType` union lets the match below narrow
  // each case on its own — generator code narrows, it does not assert.
  const schema: SchemaType = schemaNode

  const modifiers: Modifiers = {
    required,
    nullable: 'nullable' in schema ? schema.nullable : undefined,
  }

  const generatorKey = toGeneratorOnlyKey({ generatorId: myLibEntry.id })

  return match(schema)
    // Custom values pass through untouched — they are already Stringable.
    .with({ type: 'custom' }, (custom) => custom)
    .with({ type: 'ref' }, (ref) => {
      return new MyLibRef({
        context,
        destinationPath,
        refName: toRefName(ref.$ref),
        modifiers,
        rootRef,
        schema: ref,
      })
    })
    .with({ type: 'array' }, (arraySchema) => {
      return new MyLibArray({
        context,
        destinationPath,
        modifiers,
        items: arraySchema.items,
        generatorKey,
        rootRef,
        schema: arraySchema,
      })
    })
    .with({ type: 'object' }, (objectSchema) => {
      return new MyLibObject({
        context,
        destinationPath,
        objectSchema,
        modifiers,
        generatorKey,
        rootRef,
      })
    })
    .with({ type: 'union' }, (unionSchema) => {
      return new MyLibUnion({
        context,
        destinationPath,
        members: unionSchema.members,
        discriminator: unionSchema.discriminator,
        modifiers,
        generatorKey,
        rootRef,
        schema: unionSchema,
      })
    })
    .with({ type: 'string' }, (stringSchema) => {
      return new MyLibString({
        context,
        stringSchema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with({ type: 'number' }, (schema) => {
      return new MyLibNumber({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with({ type: 'integer' }, (schema) => {
      return new MyLibInteger({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with({ type: 'boolean' }, (schema) => {
      return new MyLibBoolean({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with(
      { type: 'void' },
      () => new MyLibVoid({ context, destinationPath, generatorKey }),
    )
    .with({ type: 'unknown' }, (schema) => {
      return new MyLibUnknown({
        context,
        destinationPath,
        generatorKey,
        schema,
      })
    })
    .exhaustive()
}
