import { File } from '@/dsl/File.ts'
import { Definition } from '@/dsl/Definition.ts'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { FileBase } from '@/dsl/FileBase.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { ClientSettings } from '@/types/Settings.ts'
import type { GenerateContextType, RegisterArgs } from '@/context/generateTypes.ts'

/**
 * Arguments for {@link Lang.register} — the caller-facing
 * {@link RegisterArgs} plus the `context` the language uses to reach the
 * neutral file store (`getFile` / `addFile`).
 */
export type LangRegisterArgs = RegisterArgs & {
  /** The generation context, for `getFile` / `addFile`. */
  context: GenerateContextType
}

/**
 * Arguments for {@link Lang.toDefinition} — everything the language needs
 * to wrap a generated `value` in its own `Definition` subclass.
 */
export type LangToDefinitionArgs<V extends GeneratedValue = GeneratedValue> = {
  /** The generation context. */
  context: GenerateContextType
  /** The identifier the definition is registered under. */
  identifier: Identifier
  /** The generated value being wrapped. */
  value: V
  /** Whether to omit the export keyword. */
  noExport?: boolean
  /** Optional description for a doc comment. */
  description?: string
}

/**
 * The language-specific surface a generator targets.
 *
 * A `Lang` is the object a `@skmtc/lang-*` package exposes — the concrete
 * embodiment of "a generator's imports fix its language". A generator
 * passes one to its **entry** builder (`toOasOperationEntry({ lang })` /
 * `toModelEntry({ lang })` / `toGqlOperationEntry({ lang })`), so it rides
 * in the generator config map next to `id` and `transform`.
 *
 * The engine never names a concrete `File` / `Definition` class. Instead,
 * wherever it needs to create a file or wrap a value, it knows the
 * generator's `id` (from `this.projection.id` in a Driver, or the
 * projection's static `id`) and resolves the language via
 * {@link import('@/context/generateTypes.ts').GenerateContextType.resolveLang}
 * — `toGeneratorConfigMap()[id].lang`. That lookup is always satisfiable:
 * a generator can only `insertOperation` / `insertModel` a peer it has
 * installed, and every installed generator is in the config map.
 *
 * The three members are the engine's entire language surface:
 *  - `register` — merge imports / re-exports / definitions into the file
 *    at `destinationPath`, creating it (in this language) if absent. Owns
 *    the language's merge semantics.
 *  - `toDefinition` — wrap a generated value in this language's
 *    `Definition` subclass.
 *  - `createFile` — construct this language's file. Used by `register`;
 *    exposed for the rare direct caller.
 */
export type Lang = {
  /** Construct the language's file for `path`. */
  createFile: (args: { path: string; settings: ClientSettings | undefined }) => FileBase
  /**
   * Merge imports / re-exports / definitions into the file at
   * `destinationPath`, creating the file (via this language) on first
   * write. The language owns the merge semantics (TS groups imports
   * per-module and type-tags names; other languages differ).
   */
  register: (args: LangRegisterArgs) => void
  /** Wrap a generated `value` in this language's `Definition` subclass. */
  toDefinition: <V extends GeneratedValue>(args: LangToDefinitionArgs<V>) => DefinitionBase<V>
}

/**
 * Core's transitional default language — renders the core {@link File} /
 * {@link Definition} (TypeScript). It is the **only** place core
 * constructs a concrete `File` / `Definition`; the engine reaches it only
 * through {@link Lang}, never by naming the classes.
 *
 * `register` delegates the merge to the (still TypeScript-shaped)
 * `context.register`, injecting the core-`File` factory. Moves to
 * `@skmtc/lang-typescript`'s `typescript` Lang (rendering on `TsFile` /
 * `TsDefinition`) in the language split, after which `coreLang` and the
 * core `File` are removed.
 */
export const coreLang: Lang = {
  createFile: ({ path, settings }) => new File({ path, settings }),
  register: ({ context, ...args }) =>
    context.register({
      ...args,
      createFile: path => new File({ path, settings: context.settings })
    }),
  toDefinition: ({ context, identifier, value, noExport, description }) =>
    new Definition({ context, identifier, value, noExport, description })
}
