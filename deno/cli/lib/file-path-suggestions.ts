import { join, dirname, basename, resolve, relative } from '@std/path'
import { isUrl } from '@/lib/is-url.ts'

export interface FilePathSuggestionsOptions {
  extensions?: string[]
  maxSuggestions?: number
  basePath?: string
}

/**
 * Generate file path suggestions based on user input
 * @param input - The current user input
 * @param options - Options for filtering suggestions
 * @returns Array of suggested file paths
 */
export const getFilePathSuggestions = async (
  input: string,
  {
    extensions = ['.json', '.yaml', '.yml'],
    maxSuggestions = 10,
    basePath
  }: FilePathSuggestionsOptions = {}
): Promise<string[]> => {
  // Don't suggest for URLs
  if (isUrl(input)) {
    return []
  }

  // Handle empty input - suggest files in current directory
  if (!input || input.trim() === '') {
    const suggestions = await getSuggestionsForDirectory(Deno.cwd(), '', extensions, maxSuggestions)
    // Convert to relative paths if basePath provided
    if (basePath) {
      return suggestions.map(s => {
        const hasTrailingSlash = s.endsWith('/')
        const relativePath = toRelativePath(s, basePath)
        // Preserve trailing slash for directories
        return hasTrailingSlash && !relativePath.endsWith('/') ? relativePath + '/' : relativePath
      })
    }
    return suggestions
  }

  // Parse input to get directory and partial filename
  const inputPath = input.trim()
  let dirPath: string
  let partialName: string

  // Check if input ends with a separator (user wants to list directory contents)
  if (inputPath.endsWith('/')) {
    dirPath = inputPath
    partialName = ''
  } else {
    dirPath = dirname(inputPath)
    partialName = basename(inputPath)
  }

  // Resolve directory path
  const resolvedDir = dirPath === '.' ? Deno.cwd() : resolve(Deno.cwd(), dirPath)

  const suggestions = await getSuggestionsForDirectory(
    resolvedDir,
    partialName,
    extensions,
    maxSuggestions
  )

  // Convert to relative paths if basePath provided
  if (basePath) {
    return suggestions.map(s => {
      const hasTrailingSlash = s.endsWith('/')
      const relativePath = toRelativePath(s, basePath)
      // Preserve trailing slash for directories
      return hasTrailingSlash && !relativePath.endsWith('/') ? relativePath + '/' : relativePath
    })
  }

  return suggestions
}

/**
 * Get suggestions for a specific directory
 */
const getSuggestionsForDirectory = async (
  dirPath: string,
  partialName: string,
  extensions: string[],
  maxSuggestions: number
): Promise<string[]> => {
  try {
    const entries: string[] = []

    // Read directory contents
    for await (const entry of Deno.readDir(dirPath)) {
      const name = entry.name

      // Filter by partial name if provided
      if (partialName && !name.toLowerCase().startsWith(partialName.toLowerCase())) {
        continue
      }

      if (entry.isDirectory) {
        // Include directories with trailing slash
        entries.push(`${name}/`)
      } else if (entry.isFile) {
        // Check if file has allowed extension
        const hasAllowedExtension = extensions.some(ext =>
          name.toLowerCase().endsWith(ext.toLowerCase())
        )
        if (hasAllowedExtension) {
          entries.push(name)
        }
      }
    }

    // Sort: directories first, then files, both alphabetically
    entries.sort((a, b) => {
      const aIsDir = a.endsWith('/')
      const bIsDir = b.endsWith('/')

      if (aIsDir && !bIsDir) return -1
      if (!aIsDir && bIsDir) return 1

      return a.localeCompare(b)
    })

    // Construct full paths and limit results
    const suggestions = entries.slice(0, maxSuggestions).map(entry => {
      return join(dirPath, entry)
    })

    return suggestions
  } catch (_error) {
    // Handle permission errors or non-existent directories silently
    return []
  }
}

/**
 * Find the longest common prefix among an array of strings
 * @param strings - Array of strings to find common prefix
 * @returns The longest common prefix, or empty string if none
 */
export const getCommonPrefix = (strings: string[]): string => {
  if (strings.length === 0) return ''
  if (strings.length === 1) return strings[0]

  // Start with the first string as reference
  let prefix = strings[0]

  // Compare with each subsequent string
  for (let i = 1; i < strings.length; i++) {
    // Reduce prefix until it matches the start of current string
    while (strings[i].indexOf(prefix) !== 0) {
      prefix = prefix.substring(0, prefix.length - 1)
      if (prefix === '') return ''
    }
  }

  return prefix
}

/**
 * Determine what completion to apply based on current value and suggestions
 * Implements Linux-style tab completion logic:
 * - Single match: return that match
 * - Multiple matches: return common prefix if longer than current input
 * - No improvement: return null
 *
 * @param currentValue - The current input value
 * @param suggestions - Array of available suggestions
 * @returns The value to complete to, or null if no completion available
 */
export const findSuggestionToApply = (
  currentValue: string,
  suggestions: string[]
): string | null => {
  if (suggestions.length === 0) return null
  if (suggestions.length === 1) return suggestions[0]

  // Multiple suggestions - find common prefix
  const commonPrefix = getCommonPrefix(suggestions)

  // Only return prefix if it's longer than current input
  if (commonPrefix.length > currentValue.length) {
    return commonPrefix
  }

  return null
}

/**
 * Convert an absolute path to a relative path from a base directory
 * @param absolutePath - The absolute path to convert
 * @param basePath - The base directory to compute relative path from
 * @returns The relative path, or absolute path if outside basePath
 */
export const toRelativePath = (absolutePath: string, basePath: string): string => {
  try {
    // Resolve both paths to handle symlinks (like /var -> /private/var on macOS)
    const resolvedAbsolute = Deno.realPathSync(resolve(absolutePath))
    const resolvedBase = Deno.realPathSync(resolve(basePath))

    const relativePath = relative(resolvedBase, resolvedAbsolute)

    // If path goes outside base (starts with ..), return absolute
    // This keeps external paths clear
    if (relativePath.startsWith('..')) {
      return absolutePath
    }

    return relativePath || '.'
  } catch {
    // If any error (like file doesn't exist), return original path
    return absolutePath
  }
}
