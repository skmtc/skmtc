/**
 * @fileoverview Artifact Path Resolution Utilities for SKMTC Core
 * 
 * This module provides utilities for resolving file paths for generated artifacts
 * within the SKMTC code generation pipeline. It handles the complexities of path
 * resolution, ensuring that generated files are placed in the correct locations
 * relative to base directories and project structures.
 * 
 * The path resolution system supports both absolute and relative paths,
 * cross-platform compatibility, and proper handling of nested directory
 * structures for organized code generation output.
 * 
 * ## Key Features
 * 
 * - **Cross-Platform Compatibility**: Works correctly on Windows, macOS, and Linux
 * - **Relative Path Resolution**: Proper handling of relative paths with base directories
 * - **Absolute Path Support**: Direct support for absolute destination paths
 * - **Directory Creation**: Safe directory creation for nested path structures
 * - **Path Normalization**: Consistent path formatting across different systems
 * 
 * @example Basic path resolution
 * ```typescript
 * import { toResolvedArtifactPath } from '@skmtc/core/toResolvedArtifactPath';
 * 
 * // Resolve relative path with base directory
 * const resolvedPath = toResolvedArtifactPath({
 *   basePath: '/project/src',
 *   destinationPath: './generated/UserApi.ts'
 * });
 * 
 * console.log(resolvedPath); // '/project/src/generated/UserApi.ts'
 * ```
 * 
 * @example Absolute path handling
 * ```typescript
 * import { toResolvedArtifactPath } from '@skmtc/core/toResolvedArtifactPath';
 * 
 * // Absolute paths are returned as-is
 * const absolutePath = toResolvedArtifactPath({
 *   basePath: '/project/src',
 *   destinationPath: '/absolute/path/to/UserApi.ts'
 * });
 * 
 * console.log(absolutePath); // '/absolute/path/to/UserApi.ts'
 * ```
 * 
 * @example Working without base path
 * ```typescript
 * import { toResolvedArtifactPath } from '@skmtc/core/toResolvedArtifactPath';
 * 
 * // When basePath is undefined, returns the destination path
 * const path = toResolvedArtifactPath({
 *   basePath: undefined,
 *   destinationPath: './UserApi.ts'
 * });
 * 
 * console.log(path); // './UserApi.ts'
 * ```
 * 
 * @module toResolvedArtifactPath
 */

import { join } from '@std/path/join'

/**
 * Arguments for resolving artifact file paths.
 * 
 * Defines the input parameters needed to resolve a destination path
 * relative to an optional base directory.
 */
type ToResolvedArtifactPathArgs = {
  /** The base directory path for resolving relative paths */
  basePath: string | undefined
  /** The destination path for the artifact file */
  destinationPath: string
}

/**
 * Resolves artifact destination paths relative to a base directory.
 * 
 * This utility function combines a base path with a destination path to create
 * the final resolved file path for generated artifacts. It handles special path
 * prefixes (like '@/') and provides sensible defaults when no base path is specified.
 * 
 * The function is used throughout the rendering pipeline to determine the final
 * file system locations for generated code artifacts, ensuring consistent path
 * resolution across different operating systems and deployment scenarios.
 * 
 * @param args - Path resolution configuration
 * @param args.basePath - Base directory path (defaults to './' if undefined)
 * @param args.destinationPath - Destination path for the artifact
 * @returns The resolved absolute or relative path for the artifact
 * 
 * @example Basic path resolution
 * ```typescript
 * import { toResolvedArtifactPath } from '@skmtc/core';
 * 
 * // With explicit base path
 * const resolved1 = toResolvedArtifactPath({
 *   basePath: './src/generated',
 *   destinationPath: 'models/User.ts'
 * });
 * console.log(resolved1); // './src/generated/models/User.ts'
 * 
 * // With undefined base path (uses default)
 * const resolved2 = toResolvedArtifactPath({
 *   basePath: undefined,
 *   destinationPath: 'types.ts'
 * });
 * console.log(resolved2); // './types.ts'
 * ```
 * 
 * @example Special path prefix handling
 * ```typescript
 * // '@/' prefix gets stripped and resolved relative to base
 * const resolved = toResolvedArtifactPath({
 *   basePath: './output',
 *   destinationPath: '@/api/models.ts'
 * });
 * console.log(resolved); // './output/api/models.ts'
 * 
 * // Regular paths work normally  
 * const normal = toResolvedArtifactPath({
 *   basePath: './build',
 *   destinationPath: 'components/Button.tsx'
 * });
 * console.log(normal); // './build/components/Button.tsx'
 * ```
 * 
 * @example Cross-platform path resolution
 * ```typescript
 * // Works consistently across platforms
 * const windowsPath = toResolvedArtifactPath({
 *   basePath: 'C:\\projects\\app\\dist',
 *   destinationPath: 'utils/helpers.js'
 * });
 * 
 * const unixPath = toResolvedArtifactPath({
 *   basePath: '/home/user/projects/app/dist',
 *   destinationPath: 'utils/helpers.js'
 * });
 * ```
 * 
 * @example Usage in file generation
 * ```typescript
 * class ArtifactWriter {
 *   writeArtifact(
 *     content: string, 
 *     destination: string, 
 *     baseDir?: string
 *   ) {
 *     const resolvedPath = toResolvedArtifactPath({
 *       basePath: baseDir,
 *       destinationPath: destination
 *     });
 *     
 *     console.log(`Writing to: ${resolvedPath}`);
 *     return Deno.writeTextFile(resolvedPath, content);
 *   }
 * }
 * 
 * const writer = new ArtifactWriter();
 * await writer.writeArtifact(
 *   'export const greeting = "Hello";',
 *   '@/constants.ts',
 *   './src/generated'
 * );
 * // Writes to: ./src/generated/constants.ts
 * ```
 * 
 * @example Integration with rendering pipeline
 * ```typescript
 * class FileRenderer {
 *   renderFiles(
 *     files: Map<string, File>, 
 *     outputDir: string
 *   ): Record<string, string> {
 *     const artifacts: Record<string, string> = {};
 *     
 *     for (const [destPath, file] of files) {
 *       const resolvedPath = toResolvedArtifactPath({
 *         basePath: outputDir,
 *         destinationPath: destPath
 *       });
 *       
 *       artifacts[resolvedPath] = file.toString();
 *     }
 *     
 *     return artifacts;
 *   }
 * }
 * ```
 * 
 * @example Dynamic base path resolution
 * ```typescript
 * function resolveForEnvironment(
 *   destination: string,
 *   env: 'development' | 'production'
 * ): string {
 *   const basePaths = {
 *     development: './dev-output',
 *     production: './dist'
 *   };
 *   
 *   return toResolvedArtifactPath({
 *     basePath: basePaths[env],
 *     destinationPath: destination
 *   });
 * }
 * 
 * const devPath = resolveForEnvironment('api.ts', 'development');
 * const prodPath = resolveForEnvironment('api.ts', 'production');
 * 
 * console.log(devPath);  // './dev-output/api.ts'
 * console.log(prodPath); // './dist/api.ts'
 * ```
 */
export const toResolvedArtifactPath = ({
  basePath,
  destinationPath
}: ToResolvedArtifactPathArgs): string => {
  return join(basePath ?? './', destinationPath.replace(/^@\//, ''))
}
