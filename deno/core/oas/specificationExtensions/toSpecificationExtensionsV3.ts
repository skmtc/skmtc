import type { ParseContext } from '../../context/ParseContext.ts'

type ToSpecificationExtensionsV3Args = {
  skipped: Record<string, unknown>
  parent: unknown
  context: ParseContext
}

export const toSpecificationExtensionsV3 = ({
  skipped: s,
  parent,
  context
}: ToSpecificationExtensionsV3Args): Record<string, unknown> | undefined => {
  const { skipped, extensionFields } = extractExtensions(s)

  context.logSkippedFields(skipped, parent)

  return extensionFields
}

export const extractExtensions = (item: Record<string, unknown>) => {
  return Object.entries(item).reduce<{
    skipped: Record<string, unknown>
    extensionFields: Record<string, unknown> | undefined
  }>(
    (acc, [key, value]) => {
      if (!key.startsWith('x-')) {
        return acc
      }

      const { skipped, extensionFields } = acc

      const { [key]: _key, ...rest } = skipped

      return {
        skipped: rest,
        extensionFields: {
          ...(extensionFields ?? {}),
          [key]: value
        }
      }
    },
    { skipped: item, extensionFields: undefined }
  )
}
