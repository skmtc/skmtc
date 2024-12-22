import { z } from 'zod';
export type PrettierConfigType = {
    printWidth?: number;
    tabWidth?: number;
    useTabs?: boolean;
    semi?: boolean;
    singleQuote?: boolean;
    quoteProps?: 'as-needed' | 'consistent' | 'preserve';
    jsxSingleQuote?: boolean;
    trailingComma?: 'none' | 'es5' | 'all';
    bracketSameLine?: boolean;
    bracketSpacing?: boolean;
    jsxBracketSameLine?: boolean;
    arrowParens?: 'avoid' | 'always';
    rangeStart?: number;
    rangeEnd?: number;
    requirePragma?: boolean;
    insertPragma?: boolean;
    proseWrap?: 'always' | 'never' | 'preserve';
    htmlWhitespaceSensitivity?: 'css' | 'strict' | 'ignore';
    vueIndentScriptAndStyle?: boolean;
    endOfLine?: 'auto' | 'lf' | 'crlf' | 'cr';
    embeddedLanguageFormatting?: 'auto' | 'off';
    singleAttributePerLine?: boolean;
};
export declare const prettierConfigType: z.ZodType<PrettierConfigType>;
//# sourceMappingURL=prettierConfig.d.ts.map