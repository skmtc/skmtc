type DanglingRefErrorOptions = {
  /**
   * When the chain of `$ref`s from `ref` never reaches a component: the
   * `$ref`s written in the loop it comes back to, in the order it follows
   * them. `A` a `$ref` to `B`, and `B` to `A`, give
   * `['#/components/schemas/B', '#/components/schemas/A']`.
   */
  loop?: string[]
}

/**
 * Thrown when a reference that names nothing in the document is resolved:
 * no component has its name, or its chain of `$ref`s comes back to one it
 * has passed (`A` is a `$ref` to `B`, and `B` to `A`), so it never reaches a
 * component.
 *
 * By default the parser removes what holds such a reference, so a generator
 * never meets one. When `client.json` `system.danglingRefs` lists the
 * reference's kind, it stays, and a generator that resolves it can catch
 * this error and render something else in its place. Test for it with
 * {@link DanglingRefError.is}, not `instanceof`.
 */
export class DanglingRefError extends Error {
  /** The `$ref`, or the component name, that names nothing. */
  ref: string
  /** When the chain of `$ref`s loops: see {@link DanglingRefErrorOptions.loop}. */
  loop: string[] | undefined

  constructor(ref: string, { loop }: DanglingRefErrorOptions = {}) {
    super(
      loop === undefined
        ? `Ref "${ref}" names nothing in the document`
        : `Ref "${ref}" leads into a loop of $refs (${[...loop, ...loop.slice(0, 1)].join(' → ')}) and never reaches a component`
    )
    this.name = 'DanglingRefError'
    this.ref = ref
    this.loop = loop
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
