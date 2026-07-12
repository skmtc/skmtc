/**
 * Extracts import paths from TypeScript/JavaScript file contents
 * @param content - The file content to extract imports from
 * @returns Array of import paths (excluding relative imports)
 */
export function extractImportPaths(content: string): string[] {
  const imports = new Set<string>()

  // Remove line comments first to avoid false positives
  const cleanContent = content.replace(/\/\/.*$/gm, '')

  // Use a regex that can handle multiline imports
  const importRegex =
    /(?:^|\n)\s*(?:import|export)(?:\s+type)?\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm

  let match
  while ((match = importRegex.exec(cleanContent)) !== null) {
    const importPath = match[1]
    // Only include non-relative imports (those that don't start with . or / or @/)
    if (
      !importPath.startsWith('.') &&
      !importPath.startsWith('/') &&
      !importPath.startsWith('@/')
    ) {
      imports.add(importPath)
    }
  }

  return Array.from(imports)
}
