import { toSettings, enrichSettings, CoreContext, toEnrichments } from '@skmtc/core'
import type { ClientSettings, GeneratorsMap, GeneratorType, ParseReturn } from '@skmtc/core'

type GenerateSettingsArgs = {
  toGeneratorsMap: <EnrichmentType>() => GeneratorsMap<
    GeneratorType<EnrichmentType>,
    EnrichmentType
  >
  schema: string
  clientSettings: ClientSettings | undefined
  defaultSelected: boolean
  spanId: string
}

export const generateSettings = async ({
  toGeneratorsMap,
  schema,
  clientSettings,
  defaultSelected,
  spanId
}: GenerateSettingsArgs) => {
  const { oasDocument, extensions } = toOasDocument({ schema, spanId })

  const generatorSettings = toSettings({
    generators: Object.values(toGeneratorsMap()),
    clientSettings,
    defaultSelected,
    oasDocument
  })

  const enrichments = await toEnrichments({
    generators: Object.values(toGeneratorsMap()),
    oasDocument
  })

  const enrichedSettings = enrichSettings({ generatorSettings, enrichments })

  return { enrichedSettings, extensions }
}

type ToOasDocumentArgs = {
  schema: string
  spanId: string
}

const toOasDocument = ({ schema, spanId }: ToOasDocumentArgs): ParseReturn => {
  const context = new CoreContext({ spanId })

  return context.parse(schema)
}
