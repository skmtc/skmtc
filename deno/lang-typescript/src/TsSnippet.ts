import { SnippetBase, type GeneratedValue, type Lang } from '@skmtc/core'
import { typescript } from './tsLang.ts'
import {
  register,
  defineAndRegister,
  type TsRegisterArgs,
  type TsDefineAndRegisterArgs
} from './register.ts'
import type { TsDefinition } from './TsDefinition.ts'

/**
 * The TypeScript snippet base — where the TypeScript language enters the
 * SKMTC DSL class hierarchy.
 *
 * `@skmtc/core`'s {@link SnippetBase} is language-blind and needs no
 * `generatorKey` to register — the key stays an *optional* constructor arg
 * used for attribution (gen-maps) only. `TsSnippet` extends it and carries
 * the TypeScript {@link Lang} as a **static only**: Drivers read it off the
 * projection class (`projection.lang`), pre-construction, inherited through
 * every class built on this base (including projection classes from this
 * package's `toModelProjectionBase`). No instance slot — the register
 * methods delegate to this package's register functions, which name the
 * TypeScript classes directly.
 *
 * `destinationPath` is always **explicit** on snippets: a snippet has no
 * file or settings of its own, so the parent passes the target path through
 * the constructor. Own-file defaulting exists only on projections, in the
 * projection-base veneers.
 */
export class TsSnippet extends SnippetBase {
  /**
   * The language every class built on this base renders into. The neutral
   * {@link Lang} — the engine reads it language-blind; TypeScript's fixed
   * `type` vocabulary lives on this package's concrete types, not here.
   */
  static lang: Lang = typescript

  /**
   * Register imports / definitions into the file at `destinationPath`,
   * typed by TypeScript's concise vocabulary — keyless: no `generatorId`
   * resolution, no `generatorKey` requirement.
   */
  register(args: TsRegisterArgs & { destinationPath: string }): void {
    register(this.context, args)
  }

  /**
   * Build a {@link TsDefinition} from `value` and register it at
   * `destinationPath`.
   */
  defineAndRegister<Value extends GeneratedValue>(
    args: TsDefineAndRegisterArgs<Value>
  ): TsDefinition<Value> {
    return defineAndRegister(this.context, args)
  }
}
