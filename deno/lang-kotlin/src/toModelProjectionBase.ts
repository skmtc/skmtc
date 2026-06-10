import {
  toModelProjectionBase as toCoreModelProjectionBase,
  type ModelProjectionBaseConfig
} from '@skmtc/core'
import { KtSnippet } from './KtSnippet.ts'
import { register, type KtRegisterArgs } from './register.ts'

/**
 * Configuration for the Kotlin {@link toModelProjectionBase} veneer —
 * core's config minus `base`, which this veneer pre-binds to
 * {@link KtSnippet}.
 */
export type KtModelProjectionBaseConfig<EnrichmentType = undefined> = Omit<
  ModelProjectionBaseConfig<EnrichmentType>,
  'base'
>

/**
 * Build a Kotlin model projection base class.
 *
 * Thin veneer over core's `toModelProjectionBase`: pre-binds
 * `base: KtSnippet` (the hierarchy is language-bound at its root) and adds
 * the register ergonomics core deliberately doesn't define — typed with
 * Kotlin's concise vocabulary, which core can't name:
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
 * Operation veneers (`toOasOperationProjectionBase`,
 * `toGqlOperationProjectionBase`) arrive with the first operation-emitting
 * Kotlin generator (the Spring milestone).
 */
export const toModelProjectionBase = <EnrichmentType = undefined>(
  config: KtModelProjectionBaseConfig<EnrichmentType>
) => {
  return class extends toCoreModelProjectionBase<EnrichmentType>({ ...config, base: KtSnippet }) {
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
