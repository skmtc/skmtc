/**
 * The schema-type router: every schema node dispatches to exactly one
 * snippet class. Every branch returns a snippet OBJECT — text exists
 * only inside toString() bodies. Fine-grained attribution is captured
 * via each snippet's super call (`stackTrail: schema.stackTrail.clone()`).
 */
import { toGeneratorOnlyKey, toRefName } from '@skmtc/core'
import type { Modifiers, SchemaToValueFn, SchemaType } from '@skmtc/core'
import { match } from 'ts-pattern'
import { effectEntry } from './mod.ts'
import { EffectArray } from './EffectArray.ts'
import { EffectObject } from './EffectObject.ts'
import { EffectRef } from './EffectRef.ts'
import { EffectString } from './EffectString.ts'
import { EffectUnion } from './EffectUnion.ts'
import {
  EffectBoolean,
  EffectInteger,
  EffectNumber,
  EffectUnknown,
  EffectVoid,
} from './EffectScalars.ts'

export const toEffectValue: SchemaToValueFn = (
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

  const generatorKey = toGeneratorOnlyKey({ generatorId: effectEntry.id })

  return match(schema)
    // Custom values pass through untouched — they are already Stringable.
    .with({ type: 'custom' }, (custom) => custom)
    .with({ type: 'ref' }, (ref) => {
      return new EffectRef({
        context,
        destinationPath,
        refName: toRefName(ref.$ref),
        modifiers,
        rootRef,
        schema: ref,
      })
    })
    .with({ type: 'array' }, (arraySchema) => {
      return new EffectArray({
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
      return new EffectObject({
        context,
        destinationPath,
        objectSchema,
        modifiers,
        generatorKey,
        rootRef,
      })
    })
    .with({ type: 'union' }, (unionSchema) => {
      return new EffectUnion({
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
      return new EffectString({
        context,
        stringSchema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with({ type: 'number' }, (schema) => {
      return new EffectNumber({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with({ type: 'integer' }, (schema) => {
      return new EffectInteger({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with({ type: 'boolean' }, (schema) => {
      return new EffectBoolean({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with(
      { type: 'void' },
      () => new EffectVoid({ context, destinationPath, generatorKey }),
    )
    .with({ type: 'unknown' }, (schema) => {
      return new EffectUnknown({
        context,
        destinationPath,
        generatorKey,
        schema,
      })
    })
    .exhaustive()
}
