import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasSecurityRequirement } from './SecurityRequirement.ts'

type ToSecurityRequirementsV3Args = {
  security: Record<string, string[]>[] | undefined
  context: ParseContextType
}

export const toSecurityRequirementsV3 = ({
  security,
  context
}: ToSecurityRequirementsV3Args): OasSecurityRequirement[] | undefined => {
  if (!security) {
    return undefined
  }

  return security.map(requirement => {
    return new OasSecurityRequirement({ requirement }, context.oasDocument)
  })
}
