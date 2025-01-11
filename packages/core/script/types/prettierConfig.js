"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prettierConfigType = void 0;
const zod_openapi_1 = require("@hono/zod-openapi");
exports.prettierConfigType = zod_openapi_1.z.object({
    printWidth: zod_openapi_1.z.number().optional(),
    tabWidth: zod_openapi_1.z.number().optional(),
    useTabs: zod_openapi_1.z.boolean().optional(),
    semi: zod_openapi_1.z.boolean().optional(),
    singleQuote: zod_openapi_1.z.boolean().optional(),
    quoteProps: zod_openapi_1.z
        .union([zod_openapi_1.z.literal('as-needed'), zod_openapi_1.z.literal('consistent'), zod_openapi_1.z.literal('preserve')])
        .optional(),
    jsxSingleQuote: zod_openapi_1.z.boolean().optional(),
    trailingComma: zod_openapi_1.z.union([zod_openapi_1.z.literal('none'), zod_openapi_1.z.literal('es5'), zod_openapi_1.z.literal('all')]).optional(),
    bracketSameLine: zod_openapi_1.z.boolean().optional(),
    bracketSpacing: zod_openapi_1.z.boolean().optional(),
    jsxBracketSameLine: zod_openapi_1.z.boolean().optional(),
    arrowParens: zod_openapi_1.z.union([zod_openapi_1.z.literal('avoid'), zod_openapi_1.z.literal('always')]).optional(),
    rangeStart: zod_openapi_1.z.number().optional(),
    rangeEnd: zod_openapi_1.z.number().optional(),
    requirePragma: zod_openapi_1.z.boolean().optional(),
    insertPragma: zod_openapi_1.z.boolean().optional(),
    proseWrap: zod_openapi_1.z.union([zod_openapi_1.z.literal('always'), zod_openapi_1.z.literal('never'), zod_openapi_1.z.literal('preserve')]).optional(),
    htmlWhitespaceSensitivity: zod_openapi_1.z
        .union([zod_openapi_1.z.literal('css'), zod_openapi_1.z.literal('strict'), zod_openapi_1.z.literal('ignore')])
        .optional(),
    vueIndentScriptAndStyle: zod_openapi_1.z.boolean().optional(),
    endOfLine: zod_openapi_1.z
        .union([zod_openapi_1.z.literal('auto'), zod_openapi_1.z.literal('lf'), zod_openapi_1.z.literal('crlf'), zod_openapi_1.z.literal('cr')])
        .optional(),
    embeddedLanguageFormatting: zod_openapi_1.z.union([zod_openapi_1.z.literal('auto'), zod_openapi_1.z.literal('off')]).optional(),
    singleAttributePerLine: zod_openapi_1.z.boolean().optional()
});
