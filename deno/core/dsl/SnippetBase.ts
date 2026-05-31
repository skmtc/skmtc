import type { GenerateContextType } from '../context/generateTypes.ts'
import type { RegisterArgs } from '../context/generateTypes.ts'
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
   * single originating node. The constructor records its `stackTrail`
   * into {@link SnippetBase.schemaPointer} for fine-grained attribution.
   * Omit for snippets with no single originating node (structural /
   * boilerplate / accumulators) — they carry the empty trail and the
   * resolver inherits an ancestor / key-derived pointer.
   */
  schema?: OasSchema | OasRef<'schema'>
}

/**
 * Module-level stack of currently-rendering Snippets. Pushed in the
 * instrumented `toString` (always installed — attribution is on by
 * default) and popped in `finally` so it stays balanced even when a
 * subclass's `toString` throws.
 *
 * Each worker has its own module instance, so this state never leaks
 * across worker boundaries; rendering is synchronous within a worker.
 *
 * Exported only for the test-only `__resetRenderStack` helper below.
 * @internal
 */
const renderStack: SnippetBase[] = []

/**
 * Empties the module-level render stack. Test-only escape hatch for
 * isolating attribution tests; production code never calls this.
 * @internal
 */
export const __resetRenderStack = (): void => {
  renderStack.length = 0
}

/**
 * Abstract root of every stringifiable element in the SKMTC DSL.
 *
 * Two specializations live below this class:
 *
 * - **Projections** (`ModelProjectionBase`, `OasOperationProjectionBase`,
 *   `GqlOperationProjectionBase`) are named, exportable artifacts that the
 *   pipeline wraps in a `Definition` and registers in a `File`.
 * - **Snippets** are anonymous, embedded values whose `toString()` is spliced
 *   into the body of a Projection (or another Snippet). `Definition`,
 *   `CustomValue`, and target-language helpers like `ReactRouterPathParams`
 *   extend `SnippetBase` directly without going through a Projection base.
 *
 * Both forms share the plumbing this class provides: a generation context
 * and a `register()` shortcut for adding imports and definitions to files.
 *
 * ## Attribution (gen-maps)
 *
 * The constructor always installs an instance-level shadow `toString`
 * that captures parent/child edges via the module-level render stack
 * and caches the rendered output. Subclass authors write nothing
 * different — the wrap is transparent. Attribution is always on;
 * the run-level `postPass` config controls only whether sidecars are
 * emitted, not whether edges are captured.
 */
export class SnippetBase {
  /** The generation context providing access to OAS objects and utilities */
  context: GenerateContextType

  /** Whether this generator has been skipped */
  skipped: boolean = false

  /** Optional generator key for identification and tracking */
  generatorKey: GeneratorKey | undefined

  /**
   * Snippets that ran inside this Snippet's `toString` body. Populated
   * by the attribution wrap when the parent's `toString` invokes a
   * child's `toString` (typically via template-literal interpolation).
   * @internal
   */
  _children?: SnippetBase[]

  /**
   * Cached output of `toString`. Set by the attribution wrap on first
   * invocation; subsequent calls return the cache directly.
   * @internal
   */
  _rendered?: string

  /**
   * Position of the schema fragment this snippet was built from, as a
   * `StackTrail`. Captured from the `schema` constructor arg; the empty
   * trail (`StackTrail.empty()`) means "no single originating node", in
   * which case the post-render resolver inherits the nearest ancestor's
   * pointer or the generator-key-derived one. Converted to a JSON
   * Pointer string only at the resolver — never carried as a string here.
   * @internal
   */
  schemaPointer: StackTrail

  constructor({ context, generatorKey, schema }: SnippetBaseArgs) {
    this.context = context
    this.generatorKey = generatorKey
    this.schemaPointer = schema ? schema.stackTrail : StackTrail.empty()

    // Attribution is always on: wrap `toString` to capture parent/child
    // render edges + cache the rendered output for the span resolver.
    // `toString` must stay pure — it is invoked through this instrumented
    // shadow and its result is cached on first call.
    //
    // `this.toString` at construction time resolves via prototype to the
    // subclass's user-defined method. Capture it once so future
    // invocations of the shadow can call through to the user's code.
    const subclassToString = this.toString
    this.toString = function instrumented(this: SnippetBase): string {
      if (this._rendered !== undefined) return this._rendered

      // Cycle guard: if this instance is already on the render stack, a
      // subclass `toString` recursed into itself via composition. The
      // cache wasn't set yet on the outer call, so naive recursion would
      // never terminate. Loud failure beats stack-overflow.
      if (renderStack.includes(this)) {
        throw new Error(
          'SnippetBase: render cycle detected — a Snippet recursively ' +
            'includes itself via composition. Break the cycle in your ' +
            'generator (e.g. cache an Identifier and embed it instead).'
        )
      }

      const parent = renderStack[renderStack.length - 1]
      if (parent) (parent._children ??= []).push(this)
      renderStack.push(this)
      try {
        this._rendered = subclassToString.call(this)
        return this._rendered
      } finally {
        renderStack.pop()
      }
    }
  }

  /**
   * Registers generated artifacts with the rendering pipeline.
   */
  register(args: RegisterArgs): void {
    this.context.register(args)
  }
}
