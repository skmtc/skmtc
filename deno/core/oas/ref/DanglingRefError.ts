/**
 * Thrown when a reference that names nothing in the document is resolved.
 *
 * Under `client.json` `system.danglingRefs: strict` (the default) the parser
 * removes what holds such a reference, so a generator never meets one. Under
 * `keep` the reference stays, and a generator that resolves it can catch
 * this error and render something else in its place.
 */
export class DanglingRefError extends Error {
  /** The `$ref`, or the component name, that names nothing. */
  ref: string

  constructor(ref: string) {
    super(`Ref "${ref}" names nothing in the document`)
    this.name = 'DanglingRefError'
    this.ref = ref
  }
}
