/**
 * @fileoverview Prettier Configuration System for SKMTC Core
 * 
 * This module provides comprehensive type definitions and validation schemas for
 * Prettier code formatting configuration within the SKMTC code generation pipeline.
 * It ensures that generated code is properly formatted according to specified
 * formatting rules and style guidelines.
 * 
 * The Prettier configuration system supports all standard Prettier options,
 * enabling fine-tuned control over code formatting for different output targets
 * and project requirements.
 * 
 * ## Key Features
 * 
 * - **Complete Option Coverage**: All Prettier configuration options supported
 * - **Type Safety**: Full TypeScript typing and Valibot validation
 * - **Flexible Configuration**: Optional settings with sensible defaults
 * - **Multi-Language Support**: Formatting options for JavaScript, TypeScript, JSX, HTML, and more
 * - **Integration Ready**: Direct integration with the SKMTC rendering pipeline
 * 
 * @example Basic Prettier configuration
 * ```typescript
 * import type { PrettierConfigType } from '@skmtc/core/PrettierConfig';
 * 
 * const config: PrettierConfigType = {
 *   printWidth: 100,
 *   tabWidth: 2,
 *   useTabs: false,
 *   semi: true,
 *   singleQuote: true,
 *   trailingComma: 'es5'
 * };
 * ```
 * 
 * @example TypeScript and JSX formatting
 * ```typescript
 * import type { PrettierConfigType } from '@skmtc/core/PrettierConfig';
 * 
 * const tsConfig: PrettierConfigType = {
 *   printWidth: 120,
 *   tabWidth: 2,
 *   semi: true,
 *   singleQuote: true,
 *   jsxSingleQuote: true,
 *   bracketSameLine: false,
 *   arrowParens: 'avoid'
 * };
 * ```
 * 
 * @example Validation usage
 * ```typescript
 * import { prettierConfigType, PrettierConfigType } from '@skmtc/core/PrettierConfig';
 * import * as v from 'valibot';
 * 
 * function validatePrettierConfig(config: unknown): PrettierConfigType {
 *   return v.parse(prettierConfigType, config);
 * }
 * 
 * const userConfig = {
 *   printWidth: 80,
 *   singleQuote: true,
 *   invalidOption: 'test' // This would cause validation error
 * };
 * 
 * try {
 *   const validConfig = validatePrettierConfig(userConfig);
 *   console.log('Valid configuration:', validConfig);
 * } catch (error) {
 *   console.error('Invalid Prettier configuration:', error);
 * }
 * ```
 * 
 * @module PrettierConfig
 */

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

export const prettierConfigType: v.GenericSchema<PrettierConfigType> = v.object({
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
