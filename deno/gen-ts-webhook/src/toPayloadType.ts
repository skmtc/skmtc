import type { OasWebhook, OasSchema, OasRef, CustomValue } from '@skmtc/core'

/**
 * Map a single object-property schema to a TypeScript type. Refs are
 * resolved first; only scalar leaves get a precise type — everything else
 * (objects, arrays, unions, custom values) falls back to `unknown`. This is
 * a deliberately simple first webhook generator.
 */
const propToTs = (prop: OasSchema | OasRef<'schema'> | CustomValue): string => {
  const resolved = prop.isRef() ? prop.resolve() : prop

  switch (resolved.type) {
    case 'string':
      return 'string'
    case 'number':
    case 'integer':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'unknown'
  }
}

/**
 * Build the inline TypeScript payload type for a webhook's request body —
 * the object delivered to the handler. A flat object of scalar properties
 * renders `{ prop: type; ... }` (optional via `?` when not required);
 * anything else (no body, a non-object schema, no properties) renders
 * `unknown`.
 */
export const toPayloadType = (webhook: OasWebhook): string => {
  const schemaOrRef = webhook.toPayloadSchema()
  if (!schemaOrRef) {
    return 'unknown'
  }

  const schema = schemaOrRef.isRef() ? schemaOrRef.resolve() : schemaOrRef
  if (schema.type !== 'object') {
    return 'unknown'
  }

  const properties = schema.properties ?? {}
  const required = new Set(schema.required ?? [])
  const entries = Object.entries(properties)
  if (entries.length === 0) {
    return 'unknown'
  }

  const fields = entries.map(([name, prop]) => {
    const optional = required.has(name) ? '' : '?'
    return `${name}${optional}: ${propToTs(prop)}`
  })

  return `{ ${fields.join('; ')} }`
}
