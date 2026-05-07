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
 */
export class SnippetBase {
  /** The generation context providing access to OAS objects and utilities */
  context: GenerateContextType

  /** Whether this generator has been skipped */
  skipped: boolean = false

  /** Optional generator key for identification and tracking */
  generatorKey: GeneratorKey | undefined

  constructor({ context, generatorKey }: SnippetBaseArgs) {
    this.context = context
    this.generatorKey = generatorKey
  }

  /**
   * Registers generated artifacts with the rendering pipeline.
   */
  register(args: RegisterArgs): void {
    this.context.register(args)
  }
}
