import { SnippetBase, type GeneratedValue } from '@skmtc/core'
import { csharp, type CsLang } from './csLang.ts'
import {
  register,
  defineAndRegister,
  type CsRegisterArgs,
  type CsDefineAndRegisterArgs
} from './register.ts'
import type { CsDefinition } from './CsDefinition.ts'

/**
 * The C# snippet base — where the C# language enters the SKMTC DSL class
 * hierarchy.
 *
 * `@skmtc/core`'s {@link SnippetBase} is language-blind and needs no
 * `generatorKey` to register — the key stays an *optional* constructor arg
 * used for attribution (gen-maps) only. `CsSnippet` extends it and carries
 * the C# {@link Lang} as a **static only**: Drivers read it off the
 * projection class (`projection.lang`), pre-construction, inherited through
 * every class built on this base (including projection classes from this
 * package's `toCsModelProjectionBase`). No instance slot — the register
 * methods delegate to this package's register functions, which name the
 * C# classes directly.
 *
 * `destinationPath` is always **explicit** on snippets: a snippet has no
 * file or settings of its own, so the parent passes the target path through
 * the constructor. Own-file defaulting exists only on projections, in the
 * projection-base veneers.
 */
export class CsSnippet extends SnippetBase {
  /**
   * The language every class built on this base renders into. Typed
   * {@link CsLang} (not the loose `Lang`) so a projection-base veneer
   * inferring `L` from `base: CsSnippet` lands on `CsLang` — the tightening
   * that lets `toIdentifierType` return `IdentifierType<CsLang>`.
   */
  static lang: CsLang = csharp

  /**
   * Register imports / definitions into the file at `destinationPath`,
   * typed by C#'s concise vocabulary — keyless: no `generatorId`
   * resolution, no `generatorKey` requirement.
   */
  register(args: CsRegisterArgs & { destinationPath: string }): void {
    register(this.context, args)
  }

  /**
   * Build a {@link CsDefinition} from `value` and register it at
   * `destinationPath`.
   */
  defineAndRegister<Value extends GeneratedValue>(
    args: CsDefineAndRegisterArgs<Value>
  ): CsDefinition<Value> {
    return defineAndRegister(this.context, args)
  }
}
