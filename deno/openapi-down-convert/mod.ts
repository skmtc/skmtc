/**
 * Down-convert an OpenAPI definition from OpenAPI 3.1 to OpenAPI 3.0.
 *
 * @example
 * ```ts
 * import { Converter, type ConverterOptions } from '@skmtc/openapi-down-convert'
 *
 * const options: ConverterOptions = { allOfTransform: true }
 * const converter = new Converter(oas31Document, options)
 * const oas30Document = converter.convert()
 * ```
 *
 * @module
 */

export { Converter } from './converter.ts'
export type { ConverterOptions } from './converter.ts'
