import type { GenerateContextType, RegisterArgs } from '../context/generateTypes.ts'
import type { GeneratorKey } from './GeneratorKeys.ts'
import { fromGeneratorKey } from './GeneratorKeys.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import { langRegister, langDefineAndRegister, type LangDefineAndRegisterArgs } from '@/dsl/langRegister.ts'
import invariant from 'tiny-invariant'

/**
 * Constructor arguments for {@link SnippetBase}.
 *
 * Exported so language packages can type their snippet base constructors
 * against it (see `LangSnippetConstructor` in `dsl/Lang.ts`).
 */
export type SnippetBaseArgs = {
  /** The generation context providing OAS objects and utilities */
  context: GenerateContextType
  /** Optional generator key for tracking and identification */
  generatorKey?: GeneratorKey
  /**
   * The schema fragment this snippet was built from, when it has a
   * single originating node. The constructor records a **clone** of its
   * `stackTrail` into {@link SnippetBase.schemaPointer} for fine-grained
   * attribution. Omit for snippets with no single originating node
   * (structural / boilerplate / accumulators) — they carry the empty
   * trail and the resolver falls back to the key-derived pointer.
   */
  schema?: OasSchema | OasRef<'schema'>
}

/**
 * Minimal structural view of a concrete `SnippetBase` subclass — just
 * the `prototype` the render-phase capture installer needs in order to
 * wrap the right `toString`. Avoids depending on the full `Function`
 * type.
 */
type SnippetConstructor = { prototype: object }

/**
 * Concrete `SnippetBase` subclasses instantiated during this worker's
 * life. Populated by the constructor via `new.target` (one `Set.add`
 * per construction). The render-phase capture installer
 * ({@link import('@/anchors/CaptureSink.ts').installCapture}) reads this
 * to know which prototypes' `toString` to wrap for the single capture
 * render — and only then. Outside that render the prototypes are
 * pristine, so a stray `toString()` anywhere else captures nothing.
 *
 * Each worker has its own module instance, so this state never leaks
 * across worker boundaries.
 */
export const seenSnippetConstructors = new Set<SnippetConstructor>()

/**
 * Abstract root of every stringifiable element in the SKMTC DSL.
 *
 * Two specializations live below this class:
 *
 * - **Projections** (`ModelProjectionBase`, `OasOperationProjectionBase`,
 *   `GqlOperationProjectionBase`) are named, exportable artifacts that the
 *   pipeline wraps in a `Definition` and registers in a `File`.
 * - **Snippets** are anonymous, embedded values whose `toString()` is spliced
 *   into the body of a Projection (or another Snippet). `Definition` and
 *   `CustomValue` extend `SnippetBase` directly without going through a
 *   Projection base.
 *
 * `SnippetBase` is **language-blind** in the sense that it never names a
 * concrete `File` / `Import`: its `register` / `defineAndRegister` shortcuts
 * convert the concise generator-facing form and hand it to the agnostic
 * `context.register`, resolving the language by the snippet's `generatorId`
 * (`context.resolveLang`) — the engine owns that lookup. A registering snippet
 * therefore needs a `generatorKey` (it carries the `generatorId`).
 *
 * ## Attribution (gen-maps)
 *
 * `SnippetBase` holds **no** capture state. `toString()` is the subclass's
 * own pure method and runs verbatim everywhere. Attribution is captured by
 * a single render pass in {@link import('@/context/RenderContext.ts').RenderContext}:
 * it installs a thin wrapper around the relevant `toString` prototypes for
 * the duration of that one render, observes each invocation into a
 * transient {@link import('@/anchors/CaptureSink.ts').CaptureSink} it owns,
 * and restores the prototypes afterwards. Subclass authors write nothing
 * different, and a `toString()` outside that render is a pure pass-through.
 */
export class SnippetBase {
  /** The generation context providing access to OAS objects and utilities */
  context: GenerateContextType

  /** Whether this generator has been skipped */
  skipped: boolean = false

  /** Optional generator key for identification and tracking */
  generatorKey: GeneratorKey | undefined

  /**
   * Position of the schema fragment this snippet was built from, as a
   * `StackTrail`. A **clone** of the originating schema's trail (taken at
   * construction so it's a stable snapshot — `StackTrail` is mutable, so
   * storing the raw reference would let later reuse overwrite the captured
   * provenance). The empty trail (`StackTrail.empty()`) means "no single
   * originating node", in which case the resolver uses the
   * generator-key-derived pointer. Converted to a JSON Pointer string only
   * at the resolver — never carried as a string here.
   */
  schemaPointer: StackTrail

  constructor({ context, generatorKey, schema }: SnippetBaseArgs) {
    this.context = context
    this.generatorKey = generatorKey
    // Clone the trail: `StackTrail` is mutable and `schema.stackTrail`
    // hands out the live instance, so an un-cloned reference would alias a
    // trail that later append/remove calls could mutate out from under us.
    // The resolver reads `schemaPointer` post-render, so it must be a stable
    // snapshot taken now. `StackTrail.empty()` is already a fresh instance.
    this.schemaPointer = schema ? schema.stackTrail.clone() : StackTrail.empty()

    // Register the concrete subclass so the render-phase capture installer
    // knows which prototype's `toString` to wrap. `new.target` is the class
    // that was `new`-ed (the leaf), even through `super()` chains.
    if (new.target) seenSnippetConstructors.add(new.target)
  }

  /**
   * The registering generator's id, derived from `generatorKey`. The engine
   * resolves the language from it (`context.resolveLang`). Throws if the
   * snippet has no `generatorKey` — a registration can't be attributed to a
   * generator (and so can't resolve a language) without one.
   */
  get generatorId(): string {
    invariant(
      this.generatorKey,
      'Cannot register from a snippet that has no generatorKey — the engine ' +
        'resolves the language by generatorId, which is derived from the key.'
    )
    return fromGeneratorKey(this.generatorKey).generatorId
  }

  /**
   * Register imports / definitions into the file at `destinationPath`.
   * Converts the concise import form via the resolved language's `toImports`
   * and stores through the agnostic `context.register` — the engine creates
   * the file in the generator's language (resolved by `generatorId`).
   */
  register(args: RegisterArgs): void {
    langRegister(this, args)
  }

  /**
   * Build a `Definition` from `value` (via the resolved language) and register
   * it at `destinationPath`.
   */
  defineAndRegister<V extends GeneratedValue>(
    args: LangDefineAndRegisterArgs<V>
  ): DefinitionBase<V> {
    return langDefineAndRegister(this, args)
  }
}
