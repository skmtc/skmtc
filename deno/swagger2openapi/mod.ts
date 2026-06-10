/**
 * Convert Swagger 2.0 definitions to OpenAPI 3.0.x and validate the result.
 *
 * A Deno/TypeScript port of [swagger2openapi](https://github.com/Mermade/swagger2openapi)
 * by Mike Ralphson (BSD-3-Clause).
 *
 * @example Convert an in-memory document
 * ```ts
 * import { convertObj } from '@skmtc/swagger2openapi'
 *
 * const { openapi } = convertObj(swaggerDocument, { patch: true })
 * ```
 *
 * @example Convert a file (resolving external references)
 * ```ts
 * import { convertFile } from '@skmtc/swagger2openapi'
 *
 * const { openapi } = await convertFile('./swagger.yaml', { patch: true, resolve: true })
 * ```
 *
 * @example Validate a converted document
 * ```ts
 * import { validateSync } from '@skmtc/swagger2openapi'
 *
 * const valid = validateSync(openapi, {})
 * ```
 *
 * @module
 */

export { ConvertError, convertObj, convertStr, targetVersion } from './converter.ts'

export { convertFile, convertObjResolve, convertStream, convertUrl } from './io.ts'

export { lint, loadRules } from './linter.ts'

export { validate, validateSync, ValidationError } from './validate.ts'

export type {
  ConvertOptions,
  ConvertResult,
  External,
  ExternalHandler,
  Linter,
  LinterRule,
  LintViolation,
  ResolveOptions,
  ValidateOptions,
} from './types.ts'

export type { JsonObject, JsonValue } from './json.ts'
