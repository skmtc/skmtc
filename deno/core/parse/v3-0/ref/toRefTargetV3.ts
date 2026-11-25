import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { ComponentsEntry } from '@/oas/components/Components.ts'
import type { OasRefData } from '@/oas/ref/ref-types.ts'
import { isPlainObject } from '@/parse/isPlainObject.ts'
import { toOptionalSchemasV3 } from '@/parse/v3-0/schema/toSchemasV3.ts'
import { toOptionalParametersV3 } from '@/parse/v3-0/parameter/toParameterV3.ts'
import { toOptionalResponsesV3 } from '@/parse/v3-0/response/toResponseV3.ts'
import { toRequestBodiesV3 } from '@/parse/v3-0/requestBody/toRequestBodiesV3.ts'
import { toComponentHeadersV3 } from '@/parse/v3-0/header/toHeadersV3.ts'
import { toLinksV3 } from '@/parse/v3-0/link/toLinksV3.ts'
import { toExampleV3 } from '@/parse/v3-0/example/toExamplesV3.ts'
import { toSecuritySchemesV3 } from '@/parse/v3-0/securitySchemes/toSecuritySchemes.ts'
import { tryParseAt } from '@/context/tryParseAt.ts'

/** What {@link toRefTargetV3} parses. */
export type ToRefTargetArgs = {
  /** The kind of component the ref is written for. */
  refType: OasRefData['refType']
  /** The last segment of the target's pointer, unescaped: the key it parses under. */
  name: string
  /** The raw value at the pointer. */
  value: Record<string, unknown>
  /** The trail of the target's parent, so the target parses at its own position. */
  stackTrail: StackTrail
  context: ParseContextType
}

/** One entry of a record a components parser takes. */
type EntryOf<Records> = Records extends Record<string, infer Entry> ? Entry : never

type SchemaEntry = EntryOf<NonNullable<Parameters<typeof toOptionalSchemasV3>[0]['schemas']>>
type ParameterEntry = EntryOf<NonNullable<Parameters<typeof toOptionalParametersV3>[0]['parameters']>>
type ResponseEntry = EntryOf<NonNullable<Parameters<typeof toOptionalResponsesV3>[0]['responses']>>
type RequestBodyEntry = EntryOf<NonNullable<Parameters<typeof toRequestBodiesV3>[0]['requestBodies']>>
type HeaderEntry = EntryOf<NonNullable<Parameters<typeof toComponentHeadersV3>[0]['headers']>>
type LinkEntry = EntryOf<NonNullable<Parameters<typeof toLinksV3>[0]['links']>>
type ExampleEntry = Parameters<typeof toExampleV3>[0]['example']
type SecuritySchemeEntry = EntryOf<NonNullable<Parameters<typeof toSecuritySchemesV3>[0]['securitySchemes']>>

/**
 * The raw value read as the OpenAPI type its parser takes, as the components
 * parser reads `documentObject.components`: the parser checks what it reads.
 */
const isRawEntry = <T>(value: Record<string, unknown>): value is Record<string, unknown> & T => isPlainObject(value)

/**
 * Parses the target of a ref that does not point at a component
 * (`#/components/schemas/Pet/properties/tag`, `#/paths/~1pets/get/parameters/0`)
 * at its own position, with the parser that components of its kind use. Gives
 * `undefined` when the target does not parse (the parser has logged why).
 */
export const toRefTargetV3 = ({ refType, name, value, stackTrail, context }: ToRefTargetArgs): ComponentsEntry | undefined => {
  switch (refType) {
    case 'schema':
      return isRawEntry<SchemaEntry>(value)
        ? toOptionalSchemasV3({ schemas: { [name]: value }, stackTrail, context })?.[name]
        : undefined
    case 'parameter':
      return isRawEntry<ParameterEntry>(value)
        ? toOptionalParametersV3({ parameters: { [name]: value }, stackTrail, context })?.[name]
        : undefined
    case 'response':
      return isRawEntry<ResponseEntry>(value)
        ? toOptionalResponsesV3({ responses: { [name]: value }, stackTrail, context })?.[name]
        : undefined
    case 'requestBody':
      return isRawEntry<RequestBodyEntry>(value)
        ? toRequestBodiesV3({ requestBodies: { [name]: value }, stackTrail, context })?.[name]
        : undefined
    case 'header':
      return isRawEntry<HeaderEntry>(value)
        ? toComponentHeadersV3({ headers: { [name]: value }, stackTrail, context })?.[name]
        : undefined
    case 'link':
      return isRawEntry<LinkEntry>(value)
        ? toLinksV3({ links: { [name]: value }, stackTrail, context })?.[name]
        : undefined
    case 'example':
      // No components parser reads a single example by key, so the target
      // is parsed as `toExamplesV3` parses each entry, under `tryParseAt`.
      return isRawEntry<ExampleEntry>(value)
        ? tryParseAt({
            stackTrail,
            key: name,
            context,
            type: 'INVALID_EXAMPLE',
            parent: value,
            fn: st => toExampleV3({ example: value, stackTrail: st, context })
          })
        : undefined
    case 'securityScheme':
      return isRawEntry<SecuritySchemeEntry>(value)
        ? toSecuritySchemesV3({ securitySchemes: { [name]: value }, stackTrail, context })?.[name]
        : undefined
    default: {
      const _exhaustive: never = refType
      throw new Error(`Unhandled ref type: ${_exhaustive}`)
    }
  }
}
