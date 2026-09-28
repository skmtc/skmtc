/**
 * Matches a versioned `jsr:` specifier in an import position —
 * `from '…'`, `import '…'` or `import('…')` — capturing the package
 * name, its version and an optional subpath.
 */
const versionedJsrImportRegex =
  /(\bfrom\s*|\bimport\s*\(?\s*)(['"])jsr:(@[\w.-]+\/[\w.-]+)@([^/'"]+)(\/[^'"]*)?\2/g

type ToBareJsrSpecifiersResult = {
  /** The source with every versioned `jsr:` import rewritten to its bare name. */
  content: string
  /** Bare package name → the versioned `jsr:` specifier it replaced. */
  pins: Record<string, string>
}

/**
 * Rewrites `jsr:<name>@<version>` and `jsr:<name>@<version>/<subpath>`
 * imports to `<name>` and `<name>/<subpath>`, so versions come from
 * `deno.json#imports` rather than from each import.
 */
export const toBareJsrSpecifiers = (content: string): ToBareJsrSpecifiersResult => {
  const pins: Record<string, string> = {}

  const rewritten = content.replace(
    versionedJsrImportRegex,
    (_match, prefix: string, quote: string, name: string, version: string, subpath = '') => {
      pins[name] ??= `jsr:${name}@${version}`

      return `${prefix}${quote}${name}${subpath}${quote}`
    }
  )

  return { content: rewritten, pins }
}
