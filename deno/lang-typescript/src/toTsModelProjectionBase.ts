import { toModelProjectionBase } from '@skmtc/core'
import type { ModelProjectionBaseConfig } from '@skmtc/core'
import { TsSnippet } from './TsSnippet.ts'
import { register, type TsRegisterArgs } from './register.ts'
import type { TsLang } from './tsLang.ts'

/**
 * Build a TypeScript model projection base class.
 *
 * Thin veneer over core's `toModelProjectionBase`: passes `TsSnippet` as the
 * base (the hierarchy is language-bound at its root) and adds the register
 * ergonomics core deliberately doesn't define — typed with TypeScript's
 * concise vocabulary, which core can't name (F10):
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
 * {@link TsLang} (so `toIdentifierType` returns `IdentifierType<TsLang>` — the
 * `kind` bound to `TsEntityKind`). The base is the factory's first argument,
 * not a config field.
 */
export const toTsModelProjectionBase = <EnrichmentType = undefined>(
  config: ModelProjectionBaseConfig<EnrichmentType, TsLang>
) => {
  return class extends toModelProjectionBase(TsSnippet, config) {
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
