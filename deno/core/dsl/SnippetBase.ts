import type { GenerateContextType } from '../context/generateTypes.ts'
import type { RegisterArgs } from '../context/generateTypes.ts'
import type { GeneratorKey } from './GeneratorKeys.ts'

/**
 * Constructor arguments for {@link SnippetBase}.
 */
type SnippetBaseArgs = {
  /** The generation context providing OAS objects and utilities */
  context: GenerateContextType
  /** Optional generator key for tracking and identification */
  generatorKey?: GeneratorKey
}

/**
 * Module-level stack of currently-rendering Snippets. Pushed in the
 * instrumented `toString` (only installed when `context.attribution`
 * is set) and popped in `finally` so it stays balanced even when a
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
 * When `context.attribution` is set, the constructor installs an
 * instance-level shadow `toString` that captures parent/child edges
 * via the module-level render stack and caches the rendered output.
 * Subclass authors write nothing different — the wrap is transparent.
 * When attribution is off, no wrap is installed and there is zero
 * runtime cost.
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
   * Optional schema-document pointer for fine-grained attribution.
   * Subclasses populate this from the schema fragment they were
   * constructed with (typically via `OasBase.toLocation()`). When
   * absent, the post-render attribution resolver inherits the
   * nearest ancestor's `schemaPointer`.
   * @internal
   */
  schemaPointer?: string

  constructor({ context, generatorKey }: SnippetBaseArgs) {
    this.context = context
    this.generatorKey = generatorKey

    // Instrumentation is opt-in at the context level. Zero cost when
    // attribution is off — no wrap, no closure, no extra allocation.
    if (context.attribution) {
      // `this.toString` at construction time resolves via prototype
      // to the subclass's user-defined method. Capture it once so
      // future invocations of the instance shadow can call through
      // to the user's code.
      const subclassToString = this.toString
      this.toString = function instrumented(this: SnippetBase): string {
        if (this._rendered !== undefined) return this._rendered

        // Cycle guard: if this instance is already on the render
        // stack, a subclass `toString` recursed into itself via
        // composition. Cache hadn't been set yet on the outer call,
        // so naive recursion would never terminate. Loud failure
        // beats stack-overflow.
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
  }

  /**
   * Registers generated artifacts with the rendering pipeline.
   */
  register(args: RegisterArgs): void {
    this.context.register(args)
  }
}
