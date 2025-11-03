import type { ParseContextType } from '@/context/parseTypes.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'

type ToSpecificationExtensionsV3Args = {
  skipped: Record<string, unknown>
  parent: unknown
  parentType: string
  context: ParseContextType
}

export const toSpecificationExtensionsV3 = ({
  skipped: s,
  parent,
  parentType,
  context
}: ToSpecificationExtensionsV3Args): Record<string, unknown> | undefined => {
  const { skipped, extensionFields } = extractExtensions(s)

  if (skipped) {
    context.logSkippedFields({ skipped, parent, parentType })
  }

  return extensionFields
}

export const extractExtensions = (item: Record<string, unknown>) => {
  const entries = Object.entries(item)

  const skipped: Record<string, unknown> = {}
  const extensionFields: Record<string, unknown> = {}

  for (const [key, value] of entries) {
    if (!key.startsWith('x-')) {
      skipped[key] = value
    } else {
      extensionFields[key] = value
    }
  }

  return {
    skipped: isEmpty(skipped) ? undefined : skipped,
    extensionFields: isEmpty(extensionFields) ? undefined : extensionFields
  }
}
