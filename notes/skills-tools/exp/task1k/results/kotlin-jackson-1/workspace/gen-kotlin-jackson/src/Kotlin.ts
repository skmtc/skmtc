/**
 * The schema-type router: every schema node dispatches to exactly one
 * snippet class. Every branch returns a snippet OBJECT — text exists only
 * inside toString() bodies. Fine-grained attribution is captured via each
 * snippet's super call (`stackTrail: schema.stackTrail.clone()`).
 *
 * Every value this router produces is a Kotlin TYPE EXPRESSION (`String`,
 * `List<OrderItem>`, `Address?`). The declaration shells — a data class's
 * parameter list, an enum class's entries — are built by
 * `KotlinProjection` from the shape dispatch, because only a top-level
 * model has a name to hang them on.
 */
import { toGeneratorOnlyKey, toRefName } from '@skmtc/core'
import type { Modifiers, SchemaToValueFn, SchemaType } from '@skmtc/core'
import { match } from 'ts-pattern'
import { kotlinJacksonEntry } from './mod.ts'
import { KotlinArray } from './KotlinArray.ts'
import { KotlinObject } from './KotlinObject.ts'
import { KotlinRef } from './KotlinRef.ts'
import { KotlinString } from './KotlinString.ts'
import { KotlinUnion } from './KotlinUnion.ts'
import {
  KotlinBoolean,
  KotlinInteger,
  KotlinNumber,
  KotlinUnknown,
  KotlinVoid,
} from './KotlinScalars.ts'

export const toKotlinValue: SchemaToValueFn = (
  { schema: schemaNode, destinationPath, required, context, rootRef },
) => {
  // `schemaNode` arrives typed as the generic `Schema` parameter, and
  // TypeScript does not narrow a type parameter by discriminant. Widening
  // it to the `SchemaType` union lets the match below narrow each case on
  // its own — generator code narrows, it does not assert.
  const schema: SchemaType = schemaNode

  const modifiers: Modifiers = {
    required,
    nullable: 'nullable' in schema ? schema.nullable : undefined,
  }

  const generatorKey = toGeneratorOnlyKey({
    generatorId: kotlinJacksonEntry.id,
  })

  return match(schema)
    // Custom values pass through untouched — they are already Stringable.
    .with({ type: 'custom' }, (custom) => custom)
    .with({ type: 'ref' }, (ref) => {
      return new KotlinRef({
        context,
        destinationPath,
        refName: toRefName(ref.$ref),
        modifiers,
        rootRef,
        schema: ref,
      })
    })
    .with({ type: 'array' }, (arraySchema) => {
      return new KotlinArray({
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
      return new KotlinObject({
        context,
        destinationPath,
        objectSchema,
        modifiers,
        generatorKey,
        rootRef,
      })
    })
    .with({ type: 'union' }, (unionSchema) => {
      return new KotlinUnion({
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
      return new KotlinString({
        context,
        stringSchema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with({ type: 'number' }, (schema) => {
      return new KotlinNumber({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with({ type: 'integer' }, (schema) => {
      return new KotlinInteger({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with({ type: 'boolean' }, (schema) => {
      return new KotlinBoolean({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with(
      { type: 'void' },
      () => new KotlinVoid({ context, destinationPath, generatorKey }),
    )
    .with({ type: 'unknown' }, (schema) => {
      return new KotlinUnknown({
        context,
        destinationPath,
        generatorKey,
        modifiers,
        schema,
      })
    })
    .exhaustive()
}
