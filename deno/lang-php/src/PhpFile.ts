import { FileBase } from '@skmtc/core'

/** Constructor arguments for {@link PhpFile}. */
export type PhpFileArgs = {
  path: string
  /** The PSR-4 namespace this file declares (e.g. `App\\Models`). */
  namespace: string
}

/**
 * PHP rendering of a {@link FileBase}.
 *
 * A fourth point on the file-header spectrum (after TS's bare top-level,
 * Go's `package`, and Rust's headerless module): every PHP file opens with
 * `<?php` and a `namespace …;` declaration. The namespace mirrors the
 * directory tree under PSR-4 — for the spike it is supplied as a string;
 * deriving it from `path` is a later concern. Confirms the abstract
 * `FileBase` accommodates yet another file-opening convention.
 */
export class PhpFile extends FileBase {
  namespace: string

  constructor({ path, namespace }: PhpFileArgs) {
    super({ path })
    this.namespace = namespace
  }

  override toString(): string {
    const definitions = Array.from(this.definitions.values())
      .map(definition => definition.toString())
      .join('\n\n')

    return `<?php\n\nnamespace ${this.namespace};\n\n${definitions}`
  }
}
