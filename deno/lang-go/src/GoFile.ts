import { FileBase } from '@skmtc/core'

/** Constructor arguments for {@link GoFile}. */
export type GoFileArgs = {
  path: string
  /** The `package <name>` directive — required for every Go source file. */
  packageName: string
}

/**
 * Go rendering of a {@link FileBase}.
 *
 * Unlike TypeScript, every Go file opens with a `package <name>`
 * directive — a structural difference the file shell owns. Proves the
 * abstract `FileBase` accommodates a language whose file header differs
 * from TS's bare top-level declarations.
 */
export class GoFile extends FileBase {
  packageName: string

  constructor({ path, packageName }: GoFileArgs) {
    super({ path })
    this.packageName = packageName
  }

  override toString(): string {
    const definitions = Array.from(this.definitions.values()).map(definition =>
      definition.toString()
    )

    return [`package ${this.packageName}`, ...definitions].join('\n\n')
  }
}
