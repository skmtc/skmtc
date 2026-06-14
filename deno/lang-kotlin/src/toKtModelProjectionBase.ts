import { toModelProjectionBase } from '@skmtc/core'
import type { ModelProjectionBaseConfig } from '@skmtc/core'
import { KtSnippet } from './KtSnippet.ts'
import { register, type KtRegisterArgs } from './register.ts'
import type { KtLang } from './ktLang.ts'

/**
 * Build a Kotlin model projection base class.
 *
 * Thin veneer over core's `toModelProjectionBase`: passes `KtSnippet` as the
 * base (the hierarchy is language-bound at its root) and adds the register
 * ergonomics core deliberately doesn't define — typed with Kotlin's concise
 * vocabulary, which core can't name:
 *
 * - `register(args)` — **own-file**: `destinationPath` is always this
 *   projection's `settings.exportPath` (the foundation rule; never a
 *   fallback).
 * - `registerInto(destinationPath, args)` — the explicit cross-file path.
 *
 * Both delegate to this package's register *function* — never
 * `super.register` (lang-base members are type-erased on core's factory
 * result).
 *
 * The config is core's `ModelProjectionBaseConfig` parameterized over
 * {@link KtLang} (so `toIdentifierType` returns `IdentifierType<KtLang>` — the
 * `kind` bound to `KtEntityKind`). The base is the factory's first argument,
 * not a config field.
 *
 * The companion operation veneer {@link toKtOasOperationProjectionBase} has
 * arrived (the OAS veneer now exists, driven by gen-kotlin-sdk's Response
 * models).
 */
export const toKtModelProjectionBase = <EnrichmentType = undefined>(
  config: ModelProjectionBaseConfig<EnrichmentType, KtLang>
) => {
  return class extends toModelProjectionBase(KtSnippet, config) {
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
