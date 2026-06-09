import type { GenerateContextType } from '../context/generateTypes.ts'
import type { GeneratorKey } from './GeneratorKeys.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'

/**
 * Constructor arguments for {@link SnippetBase}.
 */
type SnippetBaseArgs = {
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
 * `SnippetBase` is **language-blind**: it holds only a generation context and
 * the attribution plumbing below — no `lang`, no `register`. A snippet that
 * needs to register imports or definitions extends a language-bound base
 * (e.g. `TypescriptSnippet` in `@skmtc/lang-typescript`), which carries the
 * language's `register` / `defineAndRegister` shortcuts.
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

}
