import type { GenerateContextType } from '../context/generateTypes.ts'
import type { GeneratorKey } from './GeneratorKeys.ts'
import { StackTrail } from '@/context/StackTrail.ts'

/**
 * Constructor arguments for {@link SnippetBase}.
 *
 * Exported so language packages can type their snippet base constructors
 * against it (see `LangSnippetConstructor` in `dsl/Lang.ts`).
 */
export type SnippetBaseArgs = {
  /** The generation context providing OAS objects and utilities */
  context: GenerateContextType
  /** Optional generator key — attribution (gen-maps) input only */
  generatorKey?: GeneratorKey
  /**
   * Position of the originating schema fragment, when the snippet has a
   * single originating node — attribution (gen-maps) input only. Callers
   * that hold a schema pass `stackTrail: schema?.stackTrail.clone() ??
   * StackTrail.empty()` — the clone stays at the call site, where the
   * live, mutable trail is in hand. Omit for snippets with no single
   * originating node (structural / boilerplate / accumulators) — they
   * carry the empty trail and the resolver falls back to the key-derived
   * pointer.
   */
  stackTrail?: StackTrail
}

/**
 * The own-property `toString` wrapper every {@link SnippetBase} instance
 * installs at construction — ONE shared function, no per-instance closure.
 *
 * Own properties shadow every prototype, so this intercepts the leaf
 * subclass's `toString` no matter where in the hierarchy it is declared —
 * the same mechanism that defeats base-prototype wrapping, used in our
 * favor. The real implementation is resolved through the prototype chain
 * from the leaf (a read made ON the prototype object isn't shadowed by the
 * instance's own property).
 *
 * Outside the capture interval (`context.captureSink` unset) this is a
 * pure pass-through — one property read and one branch. Bare test mocks
 * (`{} as GenerateContextType`) read `undefined` and take the pass-through
 * path.
 */
const capturingToString = function (this: SnippetBase): string {
  const impl = Object.getPrototypeOf(this).toString
  const sink = this.context.captureSink // undefined outside the capture interval
  return sink ? sink.observe(this, impl) : impl.call(this)
}

/**
 * Abstract root of every stringifiable element in the SKMTC DSL.
 *
 * Two specializations live below this class:
 *
 * - **Projections** — named, exportable artifacts built by the
 *   projection-base factories (`toModelProjectionBase` and the OAS/GQL
 *   siblings) on a language package's snippet base; the pipeline wraps
 *   them in a `Definition` and registers them in a file.
 * - **Snippets** are anonymous, embedded values whose `toString()` is spliced
 *   into the body of a Projection (or another Snippet). `Definition` and
 *   `CustomValue` extend `SnippetBase` directly without going through a
 *   Projection base.
 *
 * `SnippetBase` is **language-blind**: it has no `register`, no language,
 * and nothing on it can throw for lack of identity. Register ergonomics
 * live on each language package's snippet base (e.g. `TsSnippet`'s
 * `register`, which delegates to that package's register function) — a raw
 * `SnippetBase` subclass that tries to register is a compile-time error.
 * `generatorKey` and `stackTrail` are *optional* attribution inputs only.
 *
 * ## Attribution (gen-maps)
 *
 * Every instance self-wraps its `toString` at construction (an
 * own-property wrapper — shared function, non-enumerable). The wrapper is
 * gated by the **capture interval**: the span while
 * {@link import('@/context/generateTypes.ts').GenerateContextType.captureSink}
 * is set, which `RenderContext` opens around the one capturing render and
 * closes in `finally`. Inside the interval each `toString` invocation is
 * observed into the transient
 * {@link import('@/anchors/CaptureSink.ts').CaptureSink} occurrence tree;
 * outside it the wrapper is a pure pass-through. Subclass authors write
 * nothing different. Snippets constructed *during* the capture render are
 * captured too — they self-wrap at birth.
 *
 * One documented convention: declare `toString` as a prototype method,
 * never as an instance field (an arrow-function field would overwrite the
 * wrapper).
 */
export class SnippetBase {
  /** The generation context providing access to OAS objects and utilities */
  context: GenerateContextType

  /** Whether this generator has been skipped */
  skipped: boolean = false

  /** Optional generator key — attribution input only */
  generatorKey: GeneratorKey | undefined

  /**
   * Position of the schema fragment this snippet was built from, as a
   * `StackTrail`. Callers pass a stable snapshot (a **clone** taken at the
   * call site — `StackTrail` is mutable, so an un-cloned reference would
   * alias a trail that later append/remove calls could mutate). The empty
   * trail (`StackTrail.empty()`) means "no single originating node", in
   * which case the resolver uses the generator-key-derived pointer.
   * Converted to a JSON Pointer string only at the resolver — never
   * carried as a string here.
   */
  stackTrail: StackTrail

  constructor({ context, generatorKey, stackTrail }: SnippetBaseArgs) {
    this.context = context
    this.generatorKey = generatorKey
    this.stackTrail = stackTrail ?? StackTrail.empty()

    // Self-wrap for attribution capture: an own-property `toString`
    // (shared function value, non-enumerable) that observes into the
    // context's capture sink while the capture interval is open and
    // passes through otherwise.
    Object.defineProperty(this, 'toString', {
      value: capturingToString,
      configurable: true
    })
  }
}
