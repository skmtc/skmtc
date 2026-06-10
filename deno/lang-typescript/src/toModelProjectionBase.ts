import {
  toModelProjectionBase as toCoreModelProjectionBase,
  type ModelProjectionBaseConfig
} from '@skmtc/core'
import { TsSnippet } from './TsSnippet.ts'
import { register, type TsRegisterArgs } from './register.ts'

/**
 * Configuration for the TypeScript {@link toModelProjectionBase} veneer —
 * core's config minus `base`, which this veneer pre-binds to
 * {@link TsSnippet}.
 */
export type TsModelProjectionBaseConfig<EnrichmentType = undefined> = Omit<
  ModelProjectionBaseConfig<EnrichmentType>,
  'base'
>

/**
 * Build a TypeScript model projection base class.
 *
 * Thin veneer over core's `toModelProjectionBase`: pre-binds
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
export const toModelProjectionBase = <EnrichmentType = undefined>(
  config: TsModelProjectionBaseConfig<EnrichmentType>
) => {
  return class extends toCoreModelProjectionBase<EnrichmentType>({ ...config, base: TsSnippet }) {
    /**
     * Register imports/definitions in this projection's **own** export file
     * (`this.settings.exportPath`). For a different file use
     * {@link registerInto}.
     */
    register(args: TsRegisterArgs): void {
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
