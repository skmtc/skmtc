import {
  SnippetBase,
  registerViaLang,
  defineAndRegisterViaLang,
  type Lang,
  type RegisterArgs,
  type LangDefineAndRegisterArgs,
  type GeneratedValue,
  type DefinitionBase
} from '@skmtc/core'
import { typescript } from './tsLang.ts'

/**
 * The TypeScript snippet base — where the TypeScript language enters the
 * SKMTC DSL class hierarchy. SPIKE (option 2 — see `notes/lang/14`).
 *
 * `@skmtc/core`'s {@link SnippetBase} is language-blind: it knows nothing
 * about TypeScript and (in this model) needs no `generatorKey` to register.
 * `TsSnippet` extends it and carries the TypeScript {@link Lang} on both
 * sides:
 *
 * - **instance `lang`** — used by `register` / `defineAndRegister`, which
 *   convert the concise import form via `lang.toImports`, create the
 *   destination file via `lang.createFile` on first write (caller-side),
 *   and hand pure data to `context.register`.
 * - **static `lang`** — inherited by every class built on this base
 *   (including projection classes from
 *   `toModelProjectionBase({ base: TsSnippet, … })`), where Drivers read it
 *   pre-construction.
 *
 * A snippet that registers therefore needs no `generatorKey`; the key stays
 * an *optional* constructor arg used for attribution (gen-maps) only.
 */
export class TsSnippet extends SnippetBase {
  /** The language every class built on this base renders into. */
  static lang: Lang = typescript

  /** Instance-side language, used by the register helpers (`this.lang`). */
  lang: Lang = typescript

  /**
   * Register imports / definitions into the file at `destinationPath`,
   * through this snippet's own `lang` — keyless: no `generatorId`
   * resolution, no `generatorKey` requirement.
   */
  override register(args: RegisterArgs): void {
    registerViaLang(this, args)
  }

  /**
   * Build a `Definition` from `value` via this snippet's own `lang` and
   * register it at `destinationPath`.
   */
  override defineAndRegister<V extends GeneratedValue>(
    args: LangDefineAndRegisterArgs<V>
  ): DefinitionBase<V> {
    return defineAndRegisterViaLang(this, args)
  }
}
