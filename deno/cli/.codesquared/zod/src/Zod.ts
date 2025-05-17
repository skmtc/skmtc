import { ZodString } from './ZodString.ts'
import { ZodArray } from './ZodArray.ts'
import { match } from 'ts-pattern'
import { ZodRef } from './ZodRef.ts'
import { ZodObject } from './ZodObject.ts'
import { ZodUnion } from './ZodUnion.ts'
import type { SchemaToValueFn, SchemaType, Modifiers } from '@skmtc/core'
import { ZodNumber } from './ZodNumber.ts'
import { ZodInteger } from './ZodInteger.ts'
import { ZodBoolean } from './ZodBoolean.ts'
import { ZodVoid } from './ZodVoid.ts'
import { ZodUnknown } from './ZodUnknown.ts'
import { toGeneratorOnlyKey, toRefName } from '@skmtc/core'
import { zodConfig } from './config.ts'

export const toZodValue: SchemaToValueFn = ({ schema, destinationPath, required, context, rootRef }) => {
  const modifiers: Modifiers = {
    required,
    description: undefined, //'description' in schema ? schema.description : undefined,
    nullable: 'nullable' in schema ? schema.nullable : undefined
  }

  if (schema.type && schema.type !== 'ref') {
    context.register({ imports: { zod: ['z'] }, destinationPath })
  }

  const generatorKey = toGeneratorOnlyKey({ generatorId: zodConfig.id })

  return match(schema satisfies SchemaType)
    .with({ type: 'custom' }, custom => custom)
    .with({ type: 'ref' }, ref => {
      return new ZodRef({ context, destinationPath, refName: toRefName(ref.$ref), modifiers, rootRef })
    })
    .with({ type: 'array' }, ({ items }) => {
      return new ZodArray({ context, destinationPath, modifiers, items, generatorKey, rootRef })
    })
    .with({ type: 'object' }, objectSchema => {
      return new ZodObject({ context, destinationPath, objectSchema, modifiers, generatorKey, rootRef })
    })
    .with({ type: 'union' }, ({ members, discriminator }) => {
      return new ZodUnion({
        context,
        destinationPath,
        members,
        discriminator,
        modifiers,
        generatorKey,
        rootRef
      })
    })
    .with({ type: 'number' }, () => new ZodNumber({ context, modifiers, generatorKey }))
    .with({ type: 'integer' }, integerSchema => {
      return new ZodInteger({ context, integerSchema, modifiers, generatorKey })
    })
    .with({ type: 'boolean' }, () => new ZodBoolean({ context, modifiers, generatorKey }))
    .with({ type: 'void' }, () => new ZodVoid({ context, generatorKey }))
    .with(
      { type: 'string' },
      stringSchema => new ZodString({ context, stringSchema, modifiers, generatorKey })
    )
    .with({ type: 'unknown' }, () => new ZodUnknown({ context, generatorKey }))
    .exhaustive()
}