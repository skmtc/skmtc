import {
  SnippetBase,
  langRegister,
  langDefineAndRegister,
  type Lang,
  type RegisterArgs,
  type LangDefineAndRegisterArgs,
  type GeneratedValue,
  type DefinitionBase
} from '@skmtc/core'
import { typescript } from './tsLang.ts'

/**
 * Base class for TypeScript snippets that register imports or definitions.
 *
 * `@skmtc/core`'s {@link SnippetBase} is language-blind — it has no `register`
 * and no language. A snippet that needs to register library imports (an npm
 * package, a hand-written helper) or define a sibling `Definition` extends
 * `TypescriptSnippet` instead: it carries the TypeScript {@link Lang} and
 * exposes the concise `register` / `defineAndRegister` shortcuts, both routed
 * through the neutral `context.register` via the core helpers.
 *
 * Snippets have no `settings`, so callers pass `destinationPath` explicitly
 * (the parent that embeds the snippet threads it through the constructor).
 */
export class TypescriptSnippet extends SnippetBase {
  /** The language this snippet renders into — read by the register helpers. */
  lang: Lang = typescript

  /**
   * Register imports / definitions into the file at `destinationPath`.
   * Converts the concise import form (`{ 'pkg': ['Symbol'] }`) via
   * `lang.toImports` and hands the neutral result to `context.register`.
   */
  register(args: RegisterArgs): void {
    langRegister(this, args)
  }

  /**
   * Build a `Definition` from `value` via the language and register it in
   * the file at `destinationPath`.
   */
  defineAndRegister<V extends GeneratedValue>(
    args: LangDefineAndRegisterArgs<V>
  ): DefinitionBase<V> {
    return langDefineAndRegister(this, args)
  }
}
