import { toOasOperationProjectionBase as toCoreOasOperationProjectionBase } from '@skmtc/core'
import type { OasOperationProjectionBaseConfig } from '@skmtc/core'
import { KtSnippet } from './KtSnippet.ts'
import { register, type KtRegisterArgs } from './register.ts'
import type { KtLang } from './ktLang.ts'

/**
 * Configuration for the Kotlin {@link toOasOperationProjectionBase}
 * veneer — core's config parameterized over {@link KtLang} (so
 * `toIdentifierType` returns `IdentifierType<KtLang>`) minus `base` (this
 * veneer pre-binds it to {@link KtSnippet}).
 *
 * No recast: the `KtLang` type argument tightens `toIdentifierType` directly.
 */
export type KtOasOperationProjectionBaseConfig<EnrichmentType = undefined> = Omit<
  OasOperationProjectionBaseConfig<EnrichmentType, KtLang>,
  'base'
>

/**
 * Build a Kotlin OAS operation projection base class — the first
 * operation-keyed Kotlin projection family (demanded by
 * gen-kotlin-sdk's Response models, arc note `32` §C4; earlier
 * operation generators were accumulator-style and didn't need one).
 *
 * Thin veneer over core's `toOasOperationProjectionBase`: pre-binds
 * `base: KtSnippet` (the hierarchy is language-bound at its root) and
 * adds the register ergonomics core deliberately doesn't define —
 * typed with Kotlin's concise vocabulary, which core can't name:
 *
 * - `register(args)` — **own-file**: `destinationPath` is always this
 *   projection's `settings.exportPath` (the foundation rule; never a
 *   fallback).
 * - `registerInto(destinationPath, args)` — the explicit cross-file path.
 *
 * Both delegate to this package's register *function* — never
 * `super.register` (lang-base members are type-erased on core's factory
 * result).
 */
export const toOasOperationProjectionBase = <EnrichmentType = undefined>(
  config: KtOasOperationProjectionBaseConfig<EnrichmentType>
) => {
  return class extends toCoreOasOperationProjectionBase<EnrichmentType>({
    ...config,
    base: KtSnippet
  }) {
    /**
     * Register imports/definitions in this projection's **own** export file
     * (`this.settings.exportPath`). For a different file use
     * {@link registerInto}.
     */
    register(args: KtRegisterArgs): void {
      register(this.context, { ...args, destinationPath: this.settings.exportPath })
    }

    /**
     * Register imports/definitions into an explicitly named file —
     * distinct from {@link register}, which always targets this
     * projection's own export file.
     */
    registerInto(destinationPath: string, args: KtRegisterArgs): void {
      register(this.context, { ...args, destinationPath })
    }
  }
}
