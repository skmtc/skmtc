/**
 * The schema-type router: every schema node dispatches to exactly one
 * snippet class. Every branch returns a snippet OBJECT — text exists
 * only inside toString() bodies. Fine-grained attribution is captured
 * via each snippet's super call (`stackTrail: schema.stackTrail.clone()`).
 */
import { toGeneratorOnlyKey, toRefName } from '@skmtc/core'
import type { Modifiers, SchemaToValueFn, SchemaType } from '@skmtc/core'
import { match } from 'ts-pattern'
import { effectSchemaEntry } from './mod.ts'
import { EffectSchemaArray } from './EffectSchemaArray.ts'
import { EffectSchemaObject } from './EffectSchemaObject.ts'
import { EffectSchemaRef } from './EffectSchemaRef.ts'
import { EffectSchemaString } from './EffectSchemaString.ts'
import { EffectSchemaUnion } from './EffectSchemaUnion.ts'
import {
  EffectSchemaBoolean,
  EffectSchemaInteger,
  EffectSchemaNumber,
  EffectSchemaUnknown,
  EffectSchemaVoid,
} from './EffectSchemaScalars.ts'

export const toEffectSchemaValue: SchemaToValueFn = (
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

  const generatorKey = toGeneratorOnlyKey({ generatorId: effectSchemaEntry.id })

  return match(schema)
    // Custom values pass through untouched — they are already Stringable.
    .with({ type: 'custom' }, (custom) => custom)
    .with({ type: 'ref' }, (ref) => {
      return new EffectSchemaRef({
        context,
        destinationPath,
        refName: toRefName(ref.$ref),
        modifiers,
        rootRef,
        schema: ref,
      })
    })
    .with({ type: 'array' }, (arraySchema) => {
      return new EffectSchemaArray({
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
      return new EffectSchemaObject({
        context,
        destinationPath,
        objectSchema,
        modifiers,
        generatorKey,
        rootRef,
      })
    })
    .with({ type: 'union' }, (unionSchema) => {
      return new EffectSchemaUnion({
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
      return new EffectSchemaString({
        context,
        stringSchema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with({ type: 'number' }, (schema) => {
      return new EffectSchemaNumber({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with({ type: 'integer' }, (schema) => {
      return new EffectSchemaInteger({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with({ type: 'boolean' }, (schema) => {
      return new EffectSchemaBoolean({
        context,
        schema,
        modifiers,
        destinationPath,
        generatorKey,
      })
    })
    .with(
      { type: 'void' },
      () => new EffectSchemaVoid({ context, destinationPath, generatorKey }),
    )
    .with({ type: 'unknown' }, (schema) => {
      return new EffectSchemaUnknown({
        context,
        destinationPath,
        generatorKey,
        schema,
      })
    })
    .exhaustive()
}
