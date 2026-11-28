import { toResolvedArtifactPath } from '@/helpers/toResolvedArtifactPath.ts'

/**
 * Represents a rendered file with metadata.
 */
export type FileObject = {
  /** The rendered file content */
  content: string
  /** The original file path */
  path: string
  /** The resolved destination path */
  destinationPath: string
  /** Number of lines in the rendered content */
  lines: number
  /** Number of characters in the rendered content */
  characters: number
}

/**
 * Arguments for rendering a single file.
 */
type RenderFileArgs = {
  /** The raw file content to render */
  content: string
  /** The destination path for the file */
  destinationPath: string
  /** Optional base path for path resolution */
  basePath?: string
}

/**
 * Renders a single file with metadata calculation.
 *
 * This function processes a single file through the rendering pipeline,
 * calculating file metadata such as line count and character count. It
 * resolves the final path using the base path configuration.
 *
 * @param args - File rendering arguments
 * @returns A FileObject with content and metadata
 *
 * @example
 * ```typescript
 * const fileObject = renderFile({
 *   content: 'const x = 1;',
 *   destinationPath: 'utils.ts',
 *   basePath: './src'
 * });
 *
 * console.log(fileObject.path); // './src/utils.ts'
 * console.log(fileObject.content); // 'const x = 1;'
 * console.log(fileObject.lines); // 1
 * console.log(fileObject.characters); // 12
 * ```
 */
export const renderFile = ({ content, destinationPath, basePath }: RenderFileArgs): FileObject => {
  const path = toResolvedArtifactPath({ basePath, destinationPath })

  return {
    content: content,
    path,
    destinationPath,
    lines: content.split('\n').length,
    characters: content.length
  }
}
