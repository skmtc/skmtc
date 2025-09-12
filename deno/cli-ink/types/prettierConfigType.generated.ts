export type PrettierConfigType =
  | {
      printWidth?: number | undefined
      tabWidth?: number | undefined
      useTabs?: boolean | undefined
      semi?: boolean | undefined
      singleQuote?: boolean | undefined
      quoteProps?: ('as-needed' | 'consistent' | 'preserve') | undefined
      jsxSingleQuote?: boolean | undefined
      trailingComma?: ('none' | 'es5' | 'all') | undefined
      bracketSameLine?: boolean | undefined
      bracketSpacing?: boolean | undefined
      jsxBracketSameLine?: boolean | undefined
      arrowParens?: ('avoid' | 'always') | undefined
      rangeStart?: number | undefined
      rangeEnd?: number | undefined
      requirePragma?: boolean | undefined
      insertPragma?: boolean | undefined
      proseWrap?: ('always' | 'never' | 'preserve') | undefined
      htmlWhitespaceSensitivity?: ('css' | 'strict' | 'ignore') | undefined
      vueIndentScriptAndStyle?: boolean | undefined
      endOfLine?: ('auto' | 'lf' | 'crlf' | 'cr') | undefined
      embeddedLanguageFormatting?: ('auto' | 'off') | undefined
      singleAttributePerLine?: boolean | undefined
    }
  | Record<string, string | boolean>
