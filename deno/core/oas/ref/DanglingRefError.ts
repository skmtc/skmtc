/**
 * Thrown when a reference that names nothing in the document is resolved.
 *
 * Under `client.json` `system.danglingRefs: strict` (the default) the parser
 * removes what holds such a reference, so a generator never meets one. Under
 * `keep` the reference stays, and a generator that resolves it can catch
 * this error and render something else in its place. Test for it with
 * {@link DanglingRefError.is}, not `instanceof`.
 */
export class DanglingRefError extends Error {
  /** The `$ref`, or the component name, that names nothing. */
  ref: string

  constructor(ref: string) {
    super(`Ref "${ref}" names nothing in the document`)
    this.name = 'DanglingRefError'
    this.ref = ref
  }

  /**
   * True when `error` is a `DanglingRefError`. It reads the error's name,
   * not its class, so it is also true for one thrown by another copy of
   * `@skmtc/core`, such as the copy a generator bundle resolves, where
   * `instanceof` is false.
   */
  static is(error: unknown): error is DanglingRefError {
    return error instanceof Error && error.name === 'DanglingRefError'
  }
}
