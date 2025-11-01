/**
 * @fileoverview GitHub API Types and Validators
 *
 * Type definitions and valibot schemas for GitHub REST API responses.
 * Used to validate API responses when fetching repository contents without
 * the octokit SDK.
 *
 * @see https://docs.github.com/en/rest/repos/contents
 */

import * as v from 'valibot'

/**
 * Schema for a single file or directory item from GitHub's contents API.
 *
 * The GitHub API returns different structures based on whether the path
 * points to a file or directory:
 * - Files have type='file' and a download_url
 * - Directories have type='dir' and no download_url
 */
export const githubContentItem = v.object({
  /**
   * Type of the item - either 'file' or 'dir'
   */
  type: v.union([v.literal('file'), v.literal('dir')]),

  /**
   * Full path to the file or directory in the repository
   */
  path: v.string(),

  /**
   * URL to download the file content.
   * Only present for files, not directories.
   * May be null in some edge cases.
   */
  download_url: v.nullable(v.optional(v.string()))
})

/**
 * Schema for GitHub contents API response.
 *
 * The API returns:
 * - A single object when the path points to a specific file
 * - An array of objects when the path points to a directory
 */
export const githubContentsResponse = v.union([
  githubContentItem,
  v.array(githubContentItem)
])

/**
 * TypeScript type for a single GitHub content item (file or directory)
 */
export type GitHubContentItem = v.InferOutput<typeof githubContentItem>

/**
 * TypeScript type for GitHub contents API response (single item or array)
 */
export type GitHubContentsResponse = v.InferOutput<typeof githubContentsResponse>
