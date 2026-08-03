import { camelCase, type RefName } from '@skmtc/core'
import { sanitizeIdentifier } from '@skmtc/lang-typescript'

/**
 * The exported constant name for a model — the ref name in PascalCase,
 * sanitised so it is always a legal binding (`Order` → `Order`,
 * `order-item` → `OrderItem`).
 */
export const toSchemaName = (refName: RefName): string =>
  sanitizeIdentifier(camelCase(refName, { upperFirst: true }))

/**
 * The unsuffixed export path for a model. The engine applies the
 * `.generated` suffix, yielding `@/models/<Name>.generated.ts`.
 */
export const toSchemaExportPath = (refName: RefName): string =>
  `@/models/${toSchemaName(refName)}.ts`
