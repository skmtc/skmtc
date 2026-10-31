import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasSecurityRequirement } from '@/oas/securityRequirement/SecurityRequirement.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { toSecurityRequirementObjects } from '@/parse/securityRequirements.ts'

export type ToSecurityRequirementsV3Args = {
  /** Raw `security`; malformed input throws (see `toSecurityRequirementObjects`). */
  security: unknown
  stackTrail: StackTrail
  context: ParseContextType
}

export const toSecurityRequirementsV3 = ({
  security,
  stackTrail,
  context
}: ToSecurityRequirementsV3Args): OasSecurityRequirement[] | undefined => {
  return toSecurityRequirementObjects(security)?.map(requirement => {
    return new OasSecurityRequirement({ requirement }, context.oasDocument)
  })
}
