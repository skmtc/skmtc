import { toSettings, enrichSettings, toEnrichments } from '@skmtc/core'
import type { ClientSettings, GeneratorsMap, GeneratorType } from '@skmtc/core'
import { toOasDocument } from './toOasDocument.ts'

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
