import { FileBase } from '@skmtc/core'

/** Constructor arguments for {@link CsFile}. */
export type CsFileArgs = {
  path: string
  /** The file-scoped namespace (C# 10 `namespace X;` form). */
  namespace: string
}

/**
 * C# rendering of a {@link FileBase}.
 *
 * Uses the C# 10 file-scoped namespace (`namespace X;`) so the file opens
 * with a single header line — another point on the file-header spectrum
 * (TS bare, Go `package`, Rust headerless, PHP `<?php` + `namespace`).
 * `using` directives land as the seam matures.
 */
export class CsFile extends FileBase {
  namespace: string

  constructor({ path, namespace }: CsFileArgs) {
    super({ path })
    this.namespace = namespace
  }

  override toString(): string {
    const definitions = Array.from(this.definitions.values())
      .map(definition => definition.toString())
      .join('\n\n')

    return `namespace ${this.namespace};\n\n${definitions}`
  }
}
