import { ModelDriver, toModelGeneratorKey } from '@skmtc/core'
import { KtSnippet } from '@skmtc/lang-kotlin'
import type {
  GenerateContextType,
  Modifiers,
  OasRef,
  OasSchema,
  RefName,
} from '@skmtc/core'
import { applyModifiers } from './modifiers.ts'
import { KotlinProjection } from './KotlinProjection.ts'
import { kotlinJacksonEntry } from './mod.ts'

type KotlinRefArgs = {
  context: GenerateContextType
  destinationPath: string
  modifiers: Modifiers
  refName: RefName
  rootRef?: RefName
  /** The originating ref schema node — for fine-grained attribution. */
  schema?: OasSchema | OasRef<'schema'>
}

/**
 * A $ref. Only the peer's NAME lands in this value tree — the Driver (or
 * the recursion branch) resolves the definition and stitches the
 * cross-file import. Never inline-expand a ref and never hand-write its
 * import. This is what makes `Address`, referenced twice by `Order`, one
 * definition in one file.
 */
export class KotlinRef extends KtSnippet {
  type = 'ref' as const
  modifiers: Modifiers
  name: string
  terminal: boolean

  constructor(
    { context, refName, destinationPath, modifiers, rootRef, schema }:
      KotlinRefArgs,
  ) {
    super({
      context,
      generatorKey: toModelGeneratorKey({
        generatorId: kotlinJacksonEntry.id,
        refName,
        variant: 'main',
      }),
      stackTrail: schema?.stackTrail.clone(),
    })

    if (context.modelDepth[`${kotlinJacksonEntry.id}:${refName}`] > 0) {
      // A back-reference to a model still open on the build stack: a
      // recursive cycle. Bump the depth so the enclosing
      // `KotlinProjection` — whose own `resolveSchemaRefOnce` set this key
      // to 1 — can detect recursion as `> 1`. `ModelDriver` resets the key
      // to 0 when the model finishes building. Constructing the peer here
      // instead would recurse forever.
      context.modelDepth[`${kotlinJacksonEntry.id}:${refName}`]++

      const settings = context.toModelContentSettings({
        refName,
        projection: KotlinProjection,
        variant: 'main',
      })

      this.name = settings.identifier.name
      this.modifiers = modifiers
      this.terminal = true
    } else {
      // The memoization path: probe the cache; hit → reuse (the peer's
      // constructor never runs) + auto-stitched import; miss → construct
      // recursively.
      const { settings } = new ModelDriver({
        context,
        refName,
        destinationPath,
        rootRef,
        projection: KotlinProjection,
        variant: 'main',
      })

      this.name = settings.identifier.name
      this.modifiers = modifiers
      this.terminal = false
    }
  }

  override toString(): string {
    // SLOT(lazy): Kotlin needs no deferred-reference form. A JVM class
    // may name itself in its own body (`children: List<Category>?`), so a
    // recursive back-reference renders exactly like any other — the
    // `terminal` flag exists only to keep the depth protocol honest, not
    // to change the syntax. That is also why SLOT(recursion-annotation) in
    // `KotlinProjection` is empty: there is no circular-inference failure
    // to break.
    return applyModifiers(this.name, this.modifiers)
  }
}
