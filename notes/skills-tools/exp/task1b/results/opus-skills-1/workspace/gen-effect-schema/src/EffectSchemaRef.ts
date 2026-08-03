import { ModelDriver, toModelGeneratorKey } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import type {
  GenerateContextType,
  Modifiers,
  OasRef,
  OasSchema,
  RefName,
} from '@skmtc/core'
import { applyModifiers } from './modifiers.ts'
import { EffectSchemaProjection } from './EffectSchemaProjection.ts'
import { effectSchemaEntry } from './mod.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type EffectSchemaRefArgs = {
  context: GenerateContextType
  destinationPath: string
  modifiers: Modifiers
  refName: RefName
  rootRef?: RefName
  /** The originating ref schema node — for fine-grained attribution. */
  schema?: OasSchema | OasRef<'schema'>
}

/**
 * A $ref. Only the peer's NAME lands in this value tree — the Driver
 * (or the recursion branch) resolves the definition and stitches the
 * cross-file import. Never inline-expand a ref and never hand-write
 * its import.
 */
export class EffectSchemaRef extends TsSnippet {
  type = 'ref' as const
  modifiers: Modifiers
  name: string
  terminal: boolean

  constructor(
    { context, refName, destinationPath, modifiers, rootRef, schema }:
      EffectSchemaRefArgs,
  ) {
    super({
      context,
      generatorKey: toModelGeneratorKey({
        generatorId: effectSchemaEntry.id,
        refName,
        variant: 'main',
      }),
      stackTrail: schema?.stackTrail.clone(),
    })

    if (context.modelDepth[`${effectSchemaEntry.id}:${refName}`] > 0) {
      // A back-reference to a model still open on the build stack: a
      // recursive cycle, rendered below via SLOT(lazy). Bump the depth
      // so the enclosing EffectSchemaProjection — whose own
      // `resolveSchemaRefOnce` set this key to 1 — can detect recursion
      // as `> 1` and annotate the export to break the target language's
      // circular type inference. `ModelDriver` resets the key to 0 when
      // the model finishes building.
      context.modelDepth[`${effectSchemaEntry.id}:${refName}`]++

      const settings = context.toModelContentSettings({
        refName,
        projection: EffectSchemaProjection,
        variant: 'main',
      })

      this.register({
        imports: { [LIB_MODULE]: [LIB] },
        destinationPath: settings.exportPath,
      })

      this.name = settings.identifier.name
      this.modifiers = modifiers
      this.terminal = true
    } else {
      // The memoization path: probe the cache; hit → reuse (the peer's
      // constructor never runs) + auto-stitched import; miss →
      // construct recursively.
      const { settings } = new ModelDriver({
        context,
        refName,
        destinationPath,
        rootRef,
        projection: EffectSchemaProjection,
        variant: 'main',
      })

      this.name = settings.identifier.name
      this.modifiers = modifiers
      this.terminal = false
    }
  }

  override toString(): string {
    // SLOT(lazy): effect's deferred-reference form is `Schema.suspend`.
    // The explicit return annotation on the thunk is load-bearing: it is
    // what lets TypeScript type the enclosing `export const` without
    // recursing into its own initializer (TS7022/TS7024). `any` is the
    // widest annotation that works without a peer-generated interface to
    // name the decoded type.
    //
    // The suspend wraps the NAME, and modifiers wrap the suspend —
    // `Schema.optional` produces a PropertySignature, which is only
    // valid in the property slot and cannot be returned from the thunk.
    const value = this.terminal
      ? `${LIB}.suspend((): ${LIB}.Schema<any> => ${this.name})`
      : this.name

    return applyModifiers(value, this.modifiers)
  }
}
