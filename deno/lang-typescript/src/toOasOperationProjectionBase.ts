import {
  toOasOperationProjectionBase as toCoreOasOperationProjectionBase,
  type OasOperationProjectionBaseConfig
} from '@skmtc/core'
import { TsSnippet } from './TsSnippet.ts'
import { register, type TsRegisterArgs } from './register.ts'

/**
 * Configuration for the TypeScript {@link toOasOperationProjectionBase}
 * veneer — core's config minus `base`, which this veneer pre-binds to
 * {@link TsSnippet}.
 */
export type TsOasOperationProjectionBaseConfig<EnrichmentType = undefined> = Omit<
  OasOperationProjectionBaseConfig<EnrichmentType>,
  'base'
>

/**
 * Build a TypeScript OAS operation projection base class.
 *
 * Thin veneer over core's `toOasOperationProjectionBase`: pre-binds
 * `base: TsSnippet` (the hierarchy is language-bound at its root) and adds
 * the register ergonomics core deliberately doesn't define — typed with
 * TypeScript's concise vocabulary, which core can't name (F10):
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
  config: TsOasOperationProjectionBaseConfig<EnrichmentType>
) => {
  return class extends toCoreOasOperationProjectionBase<EnrichmentType>({
    ...config,
    base: TsSnippet
  }) {
    /**
     * Register imports/definitions in this projection's **own** export file
     * (`this.settings.exportPath`). For a different file use
     * {@link registerInto}.
     */
    override register(args: TsRegisterArgs): void {
      register(this.context, { ...args, destinationPath: this.settings.exportPath })
    }

    /**
     * Register imports/definitions into an explicitly named file —
     * distinct from {@link register}, which always targets this
     * projection's own export file.
     */
    registerInto(destinationPath: string, args: TsRegisterArgs): void {
      register(this.context, { ...args, destinationPath })
    }
  }
}
