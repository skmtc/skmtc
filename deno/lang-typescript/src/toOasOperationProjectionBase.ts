import { toOasOperationProjectionBase as toCoreOasOperationProjectionBase } from '@skmtc/core'
import type { OasOperationProjectionBaseConfig } from '@skmtc/core'
import { TsSnippet } from './TsSnippet.ts'
import { register, type TsRegisterArgs } from './register.ts'
import type { TsLang } from './tsLang.ts'

/**
 * Configuration for the TypeScript {@link toOasOperationProjectionBase}
 * veneer — core's config parameterized over {@link TsLang} (so
 * `toIdentifierType` returns `IdentifierType<TsLang>`) minus `base` (this
 * veneer pre-binds it to {@link TsSnippet}).
 *
 * No recast: the `TsLang` type argument tightens `toIdentifierType` directly.
 */
export type TsOasOperationProjectionBaseConfig<EnrichmentType = undefined> = Omit<
  OasOperationProjectionBaseConfig<EnrichmentType, TsLang>,
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
