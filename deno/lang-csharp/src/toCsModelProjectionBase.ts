import { toModelProjectionBase } from '@skmtc/core'
import type { ModelProjectionBaseConfig } from '@skmtc/core'
import { CsSnippet } from './CsSnippet.ts'
import { register, type CsRegisterArgs } from './register.ts'
import type { CsIdentifierType } from './CsIdentifier.ts'

/**
 * Build a C# model projection base class.
 *
 * Thin veneer over core's `toModelProjectionBase`: passes `CsSnippet` as the
 * base (the hierarchy is language-bound at its root) and adds the register
 * ergonomics core deliberately doesn't define — typed with C#'s concise
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
 * {@link CsIdentifierType} (so `toIdentifierType`'s return tightens to the
 * `type` bound to `CsEntityType`). The base is the factory's first argument,
 * not a config field.
 *
 * Operation veneers (`toOasOperationProjectionBase`,
 * `toGqlOperationProjectionBase`) arrive with the first operation-emitting
 * C# generator (the CS-C ASP.NET milestone) — veneers are demand-driven,
 * the Kotlin precedent.
 */
export const toCsModelProjectionBase = <EnrichmentType = undefined>(
  config: ModelProjectionBaseConfig<EnrichmentType, CsIdentifierType>
) => {
  return class extends toModelProjectionBase(CsSnippet, config) {
    /**
     * Register imports/definitions in this projection's **own** export file
     * (`this.settings.exportPath`). For a different file use
     * {@link registerInto}.
     */
    register(args: CsRegisterArgs): void {
      register(this.context, { ...args, destinationPath: this.settings.exportPath })
    }

    /**
     * Register imports/definitions into an explicitly named file —
     * distinct from {@link register}, which always targets this
     * projection's own export file.
     */
    registerInto(destinationPath: string, args: CsRegisterArgs): void {
      register(this.context, { ...args, destinationPath })
    }
  }
}
