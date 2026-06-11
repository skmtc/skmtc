/**
 * C#'s reserved keywords — names that can never be used as identifiers
 * without the `@` verbatim-identifier prefix. Contextual keywords
 * (`record`, `init`, `required`, `partial`, `var`, `value`, `async`,
 * `await`, `nameof`, `with`, …) are NOT in this set: they are legal
 * identifiers in C# and need no escape — the same stance lang-kotlin
 * takes on soft keywords.
 *
 * Source: the C# language spec's reserved-keyword list (pinned in
 * `notes/lang/31-csharp-kickoff.md` → CS-A binding spec).
 */
export const csHardKeywords: ReadonlySet<string> = new Set([
  'abstract',
  'as',
  'base',
  'bool',
  'break',
  'byte',
  'case',
  'catch',
  'char',
  'checked',
  'class',
  'const',
  'continue',
  'decimal',
  'default',
  'delegate',
  'do',
  'double',
  'else',
  'enum',
  'event',
  'explicit',
  'extern',
  'false',
  'finally',
  'fixed',
  'float',
  'for',
  'foreach',
  'goto',
  'if',
  'implicit',
  'in',
  'int',
  'interface',
  'internal',
  'is',
  'lock',
  'long',
  'namespace',
  'new',
  'null',
  'object',
  'operator',
  'out',
  'override',
  'params',
  'private',
  'protected',
  'public',
  'readonly',
  'ref',
  'return',
  'sbyte',
  'sealed',
  'short',
  'sizeof',
  'stackalloc',
  'static',
  'string',
  'struct',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'uint',
  'ulong',
  'unchecked',
  'unsafe',
  'ushort',
  'using',
  'virtual',
  'void',
  'volatile',
  'while'
])

const csIdentifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/

/**
 * Whether `name` is a plain (unprefixed) C# identifier: a letter or
 * underscore followed by letters, digits, or underscores. Deliberately
 * ASCII-conservative — C# permits unicode letters, but anything outside
 * ASCII throws from
 * {@link import('./sanitizePropertyName.ts').sanitizePropertyName}, which
 * forces a gen-side rename (always safe).
 *
 * Note this is a SYNTAX check only — a reserved keyword like `class`
 * matches the regex but still needs the `@` prefix. Callers check
 * {@link csHardKeywords} separately.
 */
export const isCsIdentifierName = (name: string): boolean => {
  return csIdentifierRegex.test(name)
}
