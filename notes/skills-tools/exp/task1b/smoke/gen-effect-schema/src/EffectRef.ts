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
import { EffectProjection } from './EffectProjection.ts'
import { effectEntry } from './mod.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type EffectRefArgs = {
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
export class EffectRef extends TsSnippet {
  type = 'ref' as const
  modifiers: Modifiers
  name: string
  terminal: boolean

  constructor(
    { context, refName, destinationPath, modifiers, rootRef, schema }:
      EffectRefArgs,
  ) {
    super({
      context,
      generatorKey: toModelGeneratorKey({
        generatorId: effectEntry.id,
        refName,
        variant: 'main',
      }),
      stackTrail: schema?.stackTrail.clone(),
    })

    if (context.modelDepth[`${effectEntry.id}:${refName}`] > 0) {
      // A back-reference to a model still open on the build stack: a
      // recursive cycle, rendered below via SLOT(lazy). Bump the depth
      // so the enclosing EffectProjection — whose own
      // `resolveSchemaRefOnce` set this key to 1 — can detect recursion
      // as `> 1` and annotate the export to break the target language's
      // circular type inference. `ModelDriver` resets the key to 0 when
      // the model finishes building.
      context.modelDepth[`${effectEntry.id}:${refName}`]++

      const settings = context.toModelContentSettings({
        refName,
        projection: EffectProjection,
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
        projection: EffectProjection,
        variant: 'main',
      })

      this.name = settings.identifier.name
      this.modifiers = modifiers
      this.terminal = false
    }
  }

  override toString(): string {
    const out = applyModifiers(this.name, this.modifiers)

    // SLOT(lazy): effect's deferred form. The explicit return-type
    // annotation on the closure is what breaks circular inference for
    // the enclosing export — so no identifier-level typeName is needed
    // (see EffectProjection).
    return this.terminal
      ? `${LIB}.suspend((): ${LIB}.Schema<any> => ${out})`
      : out
  }
}
