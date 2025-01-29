import { toSettings, enrichSettings, toEnrichments } from '@skmtc/core'
import type { ClientSettings, GeneratorsMap, GeneratorType } from '@skmtc/core'
import { toOasDocument } from './toOasDocument.ts'
import { toV3Document, stringToSchema } from './toV3Document.ts'

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
  const documentObject = await toV3Document(stringToSchema(schema))
  const { oasDocument, extensions } = toOasDocument({ documentObject, spanId })

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
