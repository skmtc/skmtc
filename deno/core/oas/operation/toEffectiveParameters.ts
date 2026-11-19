import type { OasParameter } from '@/oas/parameter/Parameter.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { DanglingRefError } from '@/oas/ref/DanglingRefError.ts'

type Parameter = OasParameter | OasRef<'parameter'>

type ToEffectiveParametersArgs = {
  /** The operation's own parameters. */
  own: Parameter[] | undefined
  /** The parameters of the operation's path item. */
  shared: Parameter[] | undefined
}

/**
 * The parameters that apply to an operation or webhook, as OpenAPI defines
 * them: the path item's first, then its own. An own parameter with the same
 * name and location replaces the path item's. References stay references.
 * A reference that names nothing (kept under `system.danglingRefs: keep`)
 * has no name or location, so it replaces nothing and nothing replaces it.
 */
export const toEffectiveParameters = ({
  own = [],
  shared = []
}: ToEffectiveParametersArgs): Parameter[] => {
  const ownKeys = new Set(own.map(toParameterKey))

  return [
    ...shared.filter(parameter => {
      const key = toParameterKey(parameter)

      return key === undefined || !ownKeys.has(key)
    }),
    ...own
  ]
}

/**
 * Resolves each parameter. A reference that names nothing is left out: it
 * has no name or location to render, and the parser logged a `DANGLING_REF`
 * warning for it.
 */
export const toResolvedParameters = (parameters: Parameter[]): OasParameter[] =>
  parameters.flatMap(parameter => {
    const resolved = toResolvedParameter(parameter)

    return resolved === undefined ? [] : [resolved]
  })

const toParameterKey = (parameter: Parameter): string | undefined => {
  const resolved = toResolvedParameter(parameter)

  return resolved === undefined ? undefined : `${resolved.location}:${resolved.name}`
}

const toResolvedParameter = (parameter: Parameter): OasParameter | undefined => {
  try {
    return parameter.resolve()
  } catch (error) {
    if (DanglingRefError.is(error)) {
      return undefined
    }

    throw error
  }
}
