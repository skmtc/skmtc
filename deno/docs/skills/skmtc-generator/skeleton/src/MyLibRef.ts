import { toModelGeneratorKey, toModelRef } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import type {
  GenerateContextType,
  Modifiers,
  OasRef,
} from '@skmtc/core'
import { applyModifiers } from './modifiers.ts'
import { MyLibProjection } from './MyLibProjection.ts'
import { myLibEntry } from './mod.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type MyLibRefArgs = {
  context: GenerateContextType
  destinationPath: string
  modifiers: Modifiers
  /** The ref: a component, or a place inside one, such as a `$defs` entry. Its trail gives fine-grained attribution. */
  ref: OasRef<'schema'>
}

/**
 * A $ref. Only the peer's NAME lands in this value tree — `toModelRef`
 * resolves the definition and stitches the cross-file import. Never
 * inline-expand a ref and never hand-write its import.
 */
export class MyLibRef extends TsSnippet {
  type = 'ref' as const
  modifiers: Modifiers
  name: string
  /** A reference back to a model whose projection is being constructed. */
  terminal: boolean
  /** Renders via SLOT(lazy): a reference back, or any other reference inside a cycle. */
  deferred: boolean

  constructor(
    { context, ref, destinationPath, modifiers }: MyLibRefArgs,
  ) {
    super({
      context,
      generatorKey: toModelGeneratorKey({
        generatorId: myLibEntry.id,
        ref,
        variant: 'main',
      }),
      stackTrail: ref.stackTrail.clone(),
    })

    // A model that is not built yet goes through the ModelDriver: a cache
    // hit reuses it, a miss constructs it. A reference back to a model
    // whose projection is being constructed comes back `suspended`, and
    // its projection then sees `isReferencedBack` (see MyLibProjection).
    // `inCycle` marks the other references inside a cycle: any model of
    // the cycle can be the first one loaded.
    const modelRef = toModelRef({
      context,
      ref,
      destinationPath,
      projection: MyLibProjection,
      variant: 'main',
    })

    this.name = modelRef.settings.identifier.name
    this.modifiers = modifiers
    this.terminal = modelRef.suspended
    this.deferred = modelRef.suspended || modelRef.inCycle

    this.register({ imports: { [LIB_MODULE]: [LIB] }, destinationPath })
  }

  override toString(): string {
    // SLOT(lazy): the target's deferred-reference form for cycles (zod:
    // `z.lazy(() => x)`). The modifiers go outside it.
    return this.deferred
      ? applyModifiers(`${LIB}.lazy(() => ${this.name})`, this.modifiers)
      : applyModifiers(this.name, this.modifiers)
  }
}
