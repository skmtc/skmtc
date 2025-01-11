import { z } from '@hono/zod-openapi'

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

export const prettierConfigType: z.ZodType<PrettierConfigType> = z.object({
  printWidth: z.number().optional(),
  tabWidth: z.number().optional(),
  useTabs: z.boolean().optional(),
  semi: z.boolean().optional(),
  singleQuote: z.boolean().optional(),
  quoteProps: z
    .union([z.literal('as-needed'), z.literal('consistent'), z.literal('preserve')])
    .optional(),
  jsxSingleQuote: z.boolean().optional(),
  trailingComma: z.union([z.literal('none'), z.literal('es5'), z.literal('all')]).optional(),
  bracketSameLine: z.boolean().optional(),
  bracketSpacing: z.boolean().optional(),
  jsxBracketSameLine: z.boolean().optional(),
  arrowParens: z.union([z.literal('avoid'), z.literal('always')]).optional(),
  rangeStart: z.number().optional(),
  rangeEnd: z.number().optional(),
  requirePragma: z.boolean().optional(),
  insertPragma: z.boolean().optional(),
  proseWrap: z.union([z.literal('always'), z.literal('never'), z.literal('preserve')]).optional(),
  htmlWhitespaceSensitivity: z
    .union([z.literal('css'), z.literal('strict'), z.literal('ignore')])
    .optional(),
  vueIndentScriptAndStyle: z.boolean().optional(),
  endOfLine: z
    .union([z.literal('auto'), z.literal('lf'), z.literal('crlf'), z.literal('cr')])
    .optional(),
  embeddedLanguageFormatting: z.union([z.literal('auto'), z.literal('off')]).optional(),
  singleAttributePerLine: z.boolean().optional()
})
