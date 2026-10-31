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
 *   `INVALID_OPERATION`. At the root, {@link toSecurityCheck} catches it.
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

// Valid scheme types that core does not parse yet. Such a scheme logs
// INVALID_SECURITY_SCHEME but is not counted as failed, so the operations
// that require it are kept, as before.
const unmodeledSchemeTypes = ['mutualTLS']

const isUnmodeledScheme = (scheme: unknown): boolean =>
  isPlainObject(scheme) &&
  typeof scheme.type === 'string' &&
  unmodeledSchemeTypes.includes(scheme.type)

/** The document-level facts each operation's security is checked against. */
export type SecurityCheck = {
  /** The parsed root `security`; `undefined` when absent or malformed. */
  rootSecurity: OasSecurityRequirement[] | undefined
  /** Why the root `security` cannot be used, or `undefined` when it can. */
  rootProblem: string | undefined
  /** Scheme names in the document's `components.securitySchemes`. */
  declaredSchemes: string[]
  /** Declared scheme names that failed to parse. */
  failedSchemes: string[]
  context: ParseContextType
}

const quote = (names: string[]): string => names.map(name => `'${name}'`).join(', ')

const toSchemeProblem = (names: string[], reason: (one: boolean) => string): string => {
  const one = names.length === 1

  return `requires security ${one ? 'scheme' : 'schemes'} ${quote(names)}, which ${reason(one)}`
}

/** One lowercase clause per kind of unusable scheme in `security`. */
const toSchemeProblems = (
  security: OasSecurityRequirement[] | undefined,
  { declaredSchemes, failedSchemes }: Pick<SecurityCheck, 'declaredSchemes' | 'failedSchemes'>
): string[] => {
  const names = [
    ...new Set((security ?? []).flatMap(({ requirement }) => Object.keys(requirement)))
  ]

  const failed = names.filter(name => failedSchemes.includes(name))
  const undefinedNames = names.filter(name => !declaredSchemes.includes(name))

  return [
    failed.length > 0 ? toSchemeProblem(failed, () => 'failed to parse') : undefined,
    undefinedNames.length > 0
      ? toSchemeProblem(
          undefinedNames,
          one => `${one ? 'is' : 'are'} not defined in components.securitySchemes`
        )
      : undefined
  ].filter(part => part !== undefined)
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

export type ToSecurityCheckArgs = {
  /** Parses the root `security`; throws when it is malformed. */
  parse: () => OasSecurityRequirement[] | undefined
  /** The raw `components.securitySchemes`. */
  declared: Record<string, unknown> | undefined
  /** The parsed `components.securitySchemes`. */
  parsed: Record<string, unknown> | undefined
  /** Trail that ends in the root `security` key. */
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Parse the document's root `security` and collect the scheme facts that
 * {@link toOperationsWithValidSecurity} checks each operation against.
 *
 * A root `security` that is malformed, or that names a scheme that failed
 * to parse or is not defined, logs one `INVALID_OPERATION` warning at
 * `security` and sets `rootProblem`. The document then has no `security`,
 * and the operations that inherit it are dropped.
 */
export const toSecurityCheck = ({
  parse,
  declared,
  parsed,
  stackTrail,
  context
}: ToSecurityCheckArgs): SecurityCheck => {
  const declaredSchemes = Object.keys(declared ?? {})
  const failedSchemes = declaredSchemes.filter(
    name => !Object.hasOwn(parsed ?? {}, name) && !isUnmodeledScheme(declared?.[name])
  )

  const logRootProblem = (problem: string) =>
    context.logIssueNoKey({
      stackTrail,
      parent: undefined,
      level: 'warning',
      type: 'INVALID_OPERATION',
      message: `${problem}; root security is left out and operations that inherit it are dropped`
    })

  try {
    const rootSecurity = parse()
    const problems = toSchemeProblems(rootSecurity, { declaredSchemes, failedSchemes })

    if (problems.length === 0) {
      return { rootSecurity, rootProblem: undefined, declaredSchemes, failedSchemes, context }
    }

    logRootProblem(`Root security ${problems.join(' and ')}`)

    return {
      rootSecurity: undefined,
      rootProblem: `Inherits root security, which ${problems.join(' and ')}`,
      declaredSchemes,
      failedSchemes,
      context
    }
  } catch (error) {
    logRootProblem(error instanceof Error ? error.message : String(error))

    return {
      rootSecurity: undefined,
      rootProblem: 'Inherits root security, which is not a list of security requirement objects',
      declaredSchemes,
      failedSchemes,
      context
    }
  }
}

type SecuredItem = {
  security: OasSecurityRequirement[] | undefined
  stackTrail: StackTrail
}

export type ToOperationsWithValidSecurityArgs<Item extends SecuredItem> = {
  items: Item[]
  check: SecurityCheck
}

/**
 * Drop each operation or webhook whose own `security` names a scheme that
 * failed to parse or is not defined, or that has no `security` and
 * inherits an unusable root. Each dropped item logs one `INVALID_OPERATION`
 * error on its own trail. `security: []` inherits nothing and is kept.
 */
export const toOperationsWithValidSecurity = <Item extends SecuredItem>({
  items,
  check
}: ToOperationsWithValidSecurityArgs<Item>): Item[] => {
  return items.filter(item => {
    const message = item.security
      ? toSchemeProblems(item.security, check).map(capitalize).join('. ') || undefined
      : check.rootProblem

    if (message === undefined) {
      return true
    }

    check.context.logIssueNoKey({
      stackTrail: item.stackTrail,
      parent: undefined,
      level: 'error',
      type: 'INVALID_OPERATION',
      message
    })

    return false
  })
}
