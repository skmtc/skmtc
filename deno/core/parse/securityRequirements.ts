import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { OasSecurityRequirement } from '@/oas/securityRequirement/SecurityRequirement.ts'
import { isPlainObject } from '@/parse/isPlainObject.ts'
import { toKind } from '@/parse/toComponentEntries.ts'

const isScopeList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((scope: unknown) => typeof scope === 'string')

const toRequirementObject = (requirement: unknown, index: number): Record<string, string[]> => {
  if (!isPlainObject(requirement)) {
    throw new Error(
      `"security" entry ${index} must be a security requirement object, got ${toKind(requirement)}`
    )
  }

  return Object.fromEntries(
    Object.entries(requirement).map(([name, scopes]) => {
      if (!isScopeList(scopes)) {
        throw new Error(
          `"security" entry ${index} must map each scheme name to a list of scopes; '${name}' does not`
        )
      }

      return [name, scopes]
    })
  )
}

/**
 * Check a `security` field before its requirements are parsed. Shared by
 * the 3.0, 3.1 and 3.2 parsers.
 *
 * - Missing: returns `undefined`.
 * - Not an array, or an entry that is not an object of scheme name to a
 *   list of string scopes: throws, so the operation is dropped as
 *   `INVALID_OPERATION`. At the root, `toDocumentFieldsV3` catches it.
 * - Otherwise: returns the checked requirement objects.
 */
export const toSecurityRequirementObjects = (
  security: unknown
): Record<string, string[]>[] | undefined => {
  if (security === undefined) {
    return undefined
  }

  if (!Array.isArray(security)) {
    throw new Error(
      `"security" must be a list of security requirement objects, got ${toKind(security)}`
    )
  }

  return security.map((requirement: unknown, index: number) =>
    toRequirementObject(requirement, index)
  )
}

/** The parsed root `security`, or `invalid` when it threw. */
export type RootSecurity =
  | { valid: true; security: OasSecurityRequirement[] | undefined }
  | { valid: false }

export type ToRootSecurityArgs = {
  /** Parses the root `security`; throws when it is malformed. */
  parse: () => OasSecurityRequirement[] | undefined
  /** Trail that ends in the root `security` key. */
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Parse the document's root `security`. A malformed root logs one
 * `INVALID_OPERATION` warning at `security` and returns `{ valid: false }`;
 * {@link toOperationsWithValidSecurity} then drops the operations that
 * inherit it.
 */
export const toRootSecurity = ({ parse, stackTrail, context }: ToRootSecurityArgs): RootSecurity => {
  try {
    return { valid: true, security: parse() }
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error))

    context.logIssueNoKey({
      stackTrail,
      parent: undefined,
      level: 'warning',
      type: 'INVALID_OPERATION',
      message: `${normalized.message}; operations that inherit root security are dropped`
    })

    return { valid: false }
  }
}

type SecuredItem = {
  security: OasSecurityRequirement[] | undefined
  stackTrail: StackTrail
}

export type ToOperationsWithValidSecurityArgs<Item extends SecuredItem> = {
  items: Item[]
  rootSecurity: RootSecurity
  /** Scheme names in the document's `components.securitySchemes`. */
  declaredSchemes: string[]
  /** Scheme names that parsed. */
  parsedSchemes: string[]
  context: ParseContextType
}

const quote = (names: string[]): string => names.map(name => `'${name}'`).join(', ')

const toSchemeMessage = (names: string[], reason: (one: boolean) => string): string => {
  const one = names.length === 1

  return `Requires security ${one ? 'scheme' : 'schemes'} ${quote(names)}, which ${reason(one)}`
}

/**
 * Drop each operation or webhook whose effective security (its own
 * `security`, else the root `security`) names a scheme that failed to
 * parse or is not defined, or inherits a root `security` that is malformed.
 * Each dropped item logs one `INVALID_OPERATION` error on its own trail.
 * `security: []` inherits nothing and is always kept.
 */
export const toOperationsWithValidSecurity = <Item extends SecuredItem>({
  items,
  rootSecurity,
  declaredSchemes,
  parsedSchemes,
  context
}: ToOperationsWithValidSecurityArgs<Item>): Item[] => {
  return items.filter(item => {
    if (!item.security && !rootSecurity.valid) {
      context.logIssueNoKey({
        stackTrail: item.stackTrail,
        parent: undefined,
        level: 'error',
        type: 'INVALID_OPERATION',
        message: 'Inherits root security, which is not a list of security requirement objects'
      })

      return false
    }

    const security = item.security ?? (rootSecurity.valid ? rootSecurity.security : undefined)

    const names = [
      ...new Set((security ?? []).flatMap(({ requirement }) => Object.keys(requirement)))
    ]

    const failed = names.filter(
      name => declaredSchemes.includes(name) && !parsedSchemes.includes(name)
    )
    const undefinedNames = names.filter(name => !declaredSchemes.includes(name))

    if (failed.length === 0 && undefinedNames.length === 0) {
      return true
    }

    const message = [
      failed.length > 0 ? toSchemeMessage(failed, () => 'failed to parse') : undefined,
      undefinedNames.length > 0
        ? toSchemeMessage(
            undefinedNames,
            one => `${one ? 'is' : 'are'} not defined in components.securitySchemes`
          )
        : undefined
    ]
      .filter(part => part !== undefined)
      .join('. ')

    context.logIssueNoKey({
      stackTrail: item.stackTrail,
      parent: undefined,
      level: 'error',
      type: 'INVALID_OPERATION',
      message
    })

    return false
  })
}
