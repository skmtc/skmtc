import type { ParseContext } from '../../context/ParseContext.js'

type ToSpecificationExtensionsV3Args = {
  skipped: Record<string, unknown>
  context: ParseContext
}

export const toSpecificationExtensionsV3 = ({
  skipped: s,
  context
}: ToSpecificationExtensionsV3Args): Record<string, unknown> | undefined => {
  const { skipped, extensionFields } = extractExtensions(s)

  context.logSkippedFields(skipped)

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
