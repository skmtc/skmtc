import { z } from '@hono/zod-openapi';
export const prettierConfigType = z.object({
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
});
