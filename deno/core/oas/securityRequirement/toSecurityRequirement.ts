import type { ParseContext } from '../../context/ParseContext.ts'
import { OasSecurityRequirement } from './SecurityRequirement.ts'

type ToSecurityRequirementsV3Args = {
  security: Record<string, string[]>[] | undefined
  context: ParseContext
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
