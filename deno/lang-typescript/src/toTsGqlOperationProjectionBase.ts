import { toGqlOperationProjectionBase } from '@skmtc/core'
import type { GqlOperationProjectionBaseConfig } from '@skmtc/core'
import { TsSnippet } from './TsSnippet.ts'
import { register, type TsRegisterArgs } from './register.ts'
import type { TsIdentifierType } from './TsIdentifier.ts'

/**
 * Build a TypeScript GraphQL operation projection base class.
 *
 * Thin veneer over core's `toGqlOperationProjectionBase`: passes `TsSnippet`
 * as the base (the hierarchy is language-bound at its root) and adds the
 * register ergonomics core deliberately doesn't define — typed with
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
 *
 * The config is core's `GqlOperationProjectionBaseConfig` parameterized over
 * {@link TsIdentifierType} (so `toIdentifierType`'s return tightens to the
 * `type` bound to `TsEntityType`). The base is the factory's first argument,
 * not a config field.
 */
export const toTsGqlOperationProjectionBase = <EnrichmentType = undefined>(
  config: GqlOperationProjectionBaseConfig<EnrichmentType, TsIdentifierType>
) => {
  return class extends toGqlOperationProjectionBase(TsSnippet, config) {
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
