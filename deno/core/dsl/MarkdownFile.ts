import { FileBase } from '@/dsl/FileBase.ts'
import type { Stringable } from '@/dsl/Stringable.ts'

/**
 * Constructor arguments for {@link MarkdownFile}.
 */
type MarkdownFileArgs = {
  /** The file path for the generated Markdown file */
  path: string
  /** The Markdown content to write to the file */
  content: Stringable
}

/**
 * Represents a Markdown file in the SKMTC DSL system.
 *
 * The Markdown counterpart of {@link import('@/dsl/JsonFile.ts').JsonFile}: a
 * degenerate, non-code file that extends {@link FileBase} directly — it holds
 * no definitions, imports or re-exports, because Markdown has no grammar to
 * coordinate. Its `content` is any {@link Stringable} (a string or a composed
 * snippet tree) and `toString()` renders it verbatim. Written through
 * `GenerateContext.registerMarkdown`.
 *
 * @example
 * ```typescript
 * import { MarkdownFile } from '@skmtc/core';
 *
 * const doc = new MarkdownFile({
 *   path: '@/docs/GetPet.generated.md',
 *   content: '# Get pet'
 * });
 *
 * console.log(doc.toString()); // '# Get pet'
 * ```
 */
export class MarkdownFile extends FileBase {
  /** The file type, always 'markdown' for Markdown files */
  fileType: 'markdown' = 'markdown'

  /** The Markdown content to write to the file */
  content: Stringable

  /**
   * Creates a new MarkdownFile instance.
   *
   * @param args - Markdown file configuration
   * @param args.path - The output path for this Markdown file
   * @param args.content - The Markdown content to write
   */
  constructor({ path, content }: MarkdownFileArgs) {
    super({ path })
    this.content = content
  }

  /**
   * Renders the Markdown content to a string.
   *
   * @returns The Markdown content as a string
   */
  override toString(): string {
    return this.content.toString()
  }
}
