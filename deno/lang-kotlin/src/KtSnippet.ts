import { SnippetBase, type GeneratedValue } from '@skmtc/core'
import { kotlin, type KtLang } from './ktLang.ts'
import {
  register,
  defineAndRegister,
  type KtRegisterArgs,
  type KtDefineAndRegisterArgs
} from './register.ts'
import type { KtDefinition } from './KtDefinition.ts'

/**
 * The Kotlin snippet base — where the Kotlin language enters the SKMTC
 * DSL class hierarchy.
 *
 * `@skmtc/core`'s {@link SnippetBase} is language-blind and needs no
 * `generatorKey` to register — the key stays an *optional* constructor arg
 * used for attribution (gen-maps) only. `KtSnippet` extends it and carries
 * the Kotlin {@link Lang} as a **static only**: Drivers read it off the
 * projection class (`projection.lang`), pre-construction, inherited through
 * every class built on this base (including projection classes from this
 * package's `toModelProjectionBase`). No instance slot — the register
 * methods delegate to this package's register functions, which name the
 * Kotlin classes directly.
 *
 * `destinationPath` is always **explicit** on snippets: a snippet has no
 * file or settings of its own, so the parent passes the target path through
 * the constructor. Own-file defaulting exists only on projections, in the
 * projection-base veneers.
 */
export class KtSnippet extends SnippetBase {
  /**
   * The language every class built on this base renders into. Typed
   * {@link KtLang} (not the loose `Lang`) so a projection-base veneer
   * inferring `L` from `base: KtSnippet` lands on `KtLang` — the tightening
   * that lets `toIdentifierType` return `IdentifierType<KtLang>`.
   */
  static lang: KtLang = kotlin

  /**
   * Register imports / definitions into the file at `destinationPath`,
   * typed by Kotlin's concise vocabulary — keyless: no `generatorId`
   * resolution, no `generatorKey` requirement.
   */
  register(args: KtRegisterArgs & { destinationPath: string }): void {
    register(this.context, args)
  }

  /**
   * Build a {@link KtDefinition} from `value` and register it at
   * `destinationPath`.
   */
  defineAndRegister<Value extends GeneratedValue>(
    args: KtDefineAndRegisterArgs<Value>
  ): KtDefinition<Value> {
    return defineAndRegister(this.context, args)
  }
}
