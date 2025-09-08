/**
 * Utility functions for processing JSDoc content and converting links
 */

/**
 * Convert JSDoc {@link} syntax to Markdown links
 *
 * Supports several JSDoc link formats:
 * - {@link SymbolName} → [SymbolName](../SymbolName)
 * - {@link SymbolName Display Text} → [Display Text](../SymbolName)
 * - {@link module:path/SymbolName} → [SymbolName](../SymbolName)
 * - {@link external:URL} → [URL](URL)
 * - {@link https://example.com} → [https://example.com](https://example.com)
 */
export function convertJSDocLinksToMarkdown(text: string): string {
  if (!text) return text

  // Regular expression to match {@link ...} patterns
  const linkRegex = /\{@link\s+([^}]+)\}/g

  return text.replace(linkRegex, (_, linkContent) => {
    const trimmed = linkContent.trim()

    // Handle external URLs (http/https)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return `[${trimmed}](${trimmed})`
    }

    // Handle external: prefix
    if (trimmed.startsWith('external:')) {
      const url = trimmed.substring('external:'.length)
      return `[${url}](${url})`
    }

    // Split on whitespace to separate symbol from display text
    const parts = trimmed.split(/\s+/)
    const symbolPart = parts[0]
    const displayText = parts.slice(1).join(' ')

    // Extract symbol name from module: prefix if present
    let symbolName = symbolPart
    if (symbolPart.includes('module:')) {
      // Extract just the symbol name from module:path/SymbolName
      const moduleParts = symbolPart.split('/')
      symbolName = moduleParts[moduleParts.length - 1]
    } else if (symbolPart.includes(':')) {
      // Handle other prefixes by taking the part after the colon
      symbolName = symbolPart.split(':')[1]
    }

    // Generate the markdown link
    const linkText = displayText || symbolName
    const linkTarget = `/test/${symbolName}`

    return `[${linkText}](${linkTarget})`
  })
}

/**
 * Convert JSDoc {@linkcode} syntax to Markdown code links
 * {@linkcode SymbolName} → [`SymbolName`](../SymbolName)
 */
export function convertJSDocCodeLinksToMarkdown(text: string): string {
  if (!text) return text

  const codeLinkRegex = /\{@linkcode\s+([^}]+)\}/g

  return text.replace(codeLinkRegex, (match, linkContent) => {
    const trimmed = linkContent.trim()
    const parts = trimmed.split(/\s+/)
    const symbolName = parts[0]
    const displayText = parts.slice(1).join(' ') || symbolName

    return `[\`${displayText}\`](../${symbolName})`
  })
}

/**
 * Convert JSDoc {@linkplain} syntax to Markdown plain links
 * {@linkplain SymbolName} → [SymbolName](../SymbolName) (no code formatting)
 */
export function convertJSDocPlainLinksToMarkdown(text: string): string {
  if (!text) return text

  const plainLinkRegex = /\{@linkplain\s+([^}]+)\}/g

  return text.replace(plainLinkRegex, (match, linkContent) => {
    const trimmed = linkContent.trim()
    const parts = trimmed.split(/\s+/)
    const symbolName = parts[0]
    const displayText = parts.slice(1).join(' ') || symbolName

    return `[${displayText}](../${symbolName})`
  })
}

/**
 * Process all JSDoc link types in text
 * Converts {@link}, {@linkcode}, and {@linkplain} to Markdown
 */
export function processJSDocLinks(text: string): string {
  if (!text) return text

  let processed = text
  processed = convertJSDocLinksToMarkdown(processed)
  processed = convertJSDocCodeLinksToMarkdown(processed)
  processed = convertJSDocPlainLinksToMarkdown(processed)

  return processed
}

/**
 * Custom link resolver function type
 * Allows customizing how symbol names are resolved to URLs
 */
export type LinkResolver = (symbolName: string) => string

/**
 * Convert JSDoc links with a custom link resolver
 *
 * @param text - Text containing JSDoc links
 * @param resolver - Function to resolve symbol names to URLs
 */
export function convertJSDocLinksWithResolver(text: string, resolver: LinkResolver): string {
  if (!text) return text

  const linkRegex = /\{@link\s+([^}]+)\}/g

  return text.replace(linkRegex, (_, linkContent) => {
    const trimmed = linkContent.trim()

    // Handle external URLs (http/https) - don't resolve these
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return `[${trimmed}](${trimmed})`
    }

    // Handle external: prefix
    if (trimmed.startsWith('external:')) {
      const url = trimmed.substring('external:'.length)
      return `[${url}](${url})`
    }

    // Split on whitespace to separate symbol from display text
    const parts = trimmed.split(/\s+/)
    const symbolPart = parts[0]
    const displayText = parts.slice(1).join(' ')

    // Extract symbol name
    let symbolName = symbolPart
    if (symbolPart.includes('module:')) {
      const moduleParts = symbolPart.split('/')
      symbolName = moduleParts[moduleParts.length - 1]
    } else if (symbolPart.includes(':')) {
      symbolName = symbolPart.split(':')[1]
    }

    // Use resolver to get the URL
    const linkTarget = resolver(symbolName)
    const linkText = displayText || symbolName

    return `[${linkText}](${linkTarget})`
  })
}

// Example usage with different resolvers:
export const defaultResolver: LinkResolver = symbolName => `../${symbolName}`
export const hashResolver: LinkResolver = symbolName => `#${symbolName}`
export const absoluteResolver: LinkResolver = symbolName => `/docs/${symbolName}`
