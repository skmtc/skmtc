import * as v from 'valibot'

export type PrettierConfigType = {
  printWidth?: number
  tabWidth?: number
  useTabs?: boolean
  semi?: boolean
  singleQuote?: boolean
  quoteProps?: 'as-needed' | 'consistent' | 'preserve'
  jsxSingleQuote?: boolean
  trailingComma?: 'none' | 'es5' | 'all'
  bracketSameLine?: boolean
  bracketSpacing?: boolean
  jsxBracketSameLine?: boolean
  arrowParens?: 'avoid' | 'always'
  rangeStart?: number
  rangeEnd?: number
  requirePragma?: boolean
  insertPragma?: boolean
  proseWrap?: 'always' | 'never' | 'preserve'
  htmlWhitespaceSensitivity?: 'css' | 'strict' | 'ignore'
  vueIndentScriptAndStyle?: boolean
  endOfLine?: 'auto' | 'lf' | 'crlf' | 'cr'
  embeddedLanguageFormatting?: 'auto' | 'off'
  singleAttributePerLine?: boolean
}

export const prettierConfigType = v.object({
  printWidth: v.optional(v.number()),
  tabWidth: v.optional(v.number()),
  useTabs: v.optional(v.boolean()),
  semi: v.optional(v.boolean()),
  singleQuote: v.optional(v.boolean()),
  quoteProps: v.optional(
    v.union([v.literal('as-needed'), v.literal('consistent'), v.literal('preserve')])
  ),
  jsxSingleQuote: v.optional(v.boolean()),
  trailingComma: v.optional(v.union([v.literal('none'), v.literal('es5'), v.literal('all')])),
  bracketSameLine: v.optional(v.boolean()),
  bracketSpacing: v.optional(v.boolean()),
  jsxBracketSameLine: v.optional(v.boolean()),
  arrowParens: v.optional(v.union([v.literal('avoid'), v.literal('always')])),
  rangeStart: v.optional(v.number()),
  rangeEnd: v.optional(v.number()),
  requirePragma: v.optional(v.boolean()),
  insertPragma: v.optional(v.boolean()),
  proseWrap: v.optional(v.union([v.literal('always'), v.literal('never'), v.literal('preserve')])),
  htmlWhitespaceSensitivity: v.optional(
    v.union([v.literal('css'), v.literal('strict'), v.literal('ignore')])
  ),
  vueIndentScriptAndStyle: v.optional(v.boolean()),
  endOfLine: v.optional(
    v.union([v.literal('auto'), v.literal('lf'), v.literal('crlf'), v.literal('cr')])
  ),
  embeddedLanguageFormatting: v.optional(v.union([v.literal('auto'), v.literal('off')])),
  singleAttributePerLine: v.optional(v.boolean())
})
