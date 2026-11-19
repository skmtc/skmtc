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
 *
 * A reference that names nothing (kept when `system.danglingRefs` lists
 * `parameter`) has no name or location. It keeps its place, and only the
 * same `$ref` replaces it.
 */
export const toEffectiveParameters = ({
  own = [],
  shared = []
}: ToEffectiveParametersArgs): Parameter[] => {
  const ownKeys = new Set(own.map(toParameterKey))

  return [...shared.filter(parameter => !ownKeys.has(toParameterKey(parameter))), ...own]
}

const toParameterKey = (parameter: Parameter): string => {
  if (!parameter.isRef()) {
    return `${parameter.location}:${parameter.name}`
  }

  try {
    const { name, location } = parameter.resolve()

    return `${location}:${name}`
  } catch (error) {
    if (DanglingRefError.is(error)) {
      return `$ref:${parameter.$ref}`
    }

    throw error
  }
}
