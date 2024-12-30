"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prettierConfigType = void 0;
const zod_1 = require("zod");
exports.prettierConfigType = zod_1.z.object({
    printWidth: zod_1.z.number().optional(),
    tabWidth: zod_1.z.number().optional(),
    useTabs: zod_1.z.boolean().optional(),
    semi: zod_1.z.boolean().optional(),
    singleQuote: zod_1.z.boolean().optional(),
    quoteProps: zod_1.z
        .union([
        zod_1.z.literal('as-needed'),
        zod_1.z.literal('consistent'),
        zod_1.z.literal('preserve')
    ])
        .optional(),
    jsxSingleQuote: zod_1.z.boolean().optional(),
    trailingComma: zod_1.z
        .union([zod_1.z.literal('none'), zod_1.z.literal('es5'), zod_1.z.literal('all')])
        .optional(),
    bracketSameLine: zod_1.z.boolean().optional(),
    bracketSpacing: zod_1.z.boolean().optional(),
    jsxBracketSameLine: zod_1.z.boolean().optional(),
    arrowParens: zod_1.z.union([zod_1.z.literal('avoid'), zod_1.z.literal('always')]).optional(),
    rangeStart: zod_1.z.number().optional(),
    rangeEnd: zod_1.z.number().optional(),
    requirePragma: zod_1.z.boolean().optional(),
    insertPragma: zod_1.z.boolean().optional(),
    proseWrap: zod_1.z
        .union([zod_1.z.literal('always'), zod_1.z.literal('never'), zod_1.z.literal('preserve')])
        .optional(),
    htmlWhitespaceSensitivity: zod_1.z
        .union([zod_1.z.literal('css'), zod_1.z.literal('strict'), zod_1.z.literal('ignore')])
        .optional(),
    vueIndentScriptAndStyle: zod_1.z.boolean().optional(),
    endOfLine: zod_1.z
        .union([
        zod_1.z.literal('auto'),
        zod_1.z.literal('lf'),
        zod_1.z.literal('crlf'),
        zod_1.z.literal('cr')
    ])
        .optional(),
    embeddedLanguageFormatting: zod_1.z
        .union([zod_1.z.literal('auto'), zod_1.z.literal('off')])
        .optional(),
    singleAttributePerLine: zod_1.z.boolean().optional()
});
