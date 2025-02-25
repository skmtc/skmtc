import { toSettings, enrichSettings } from '@skmtc/core'
import type { ClientSettings, GeneratorsMapContainer } from '@skmtc/core'
import { toOasDocument } from './toOasDocument.ts'
import { toV3Document, stringToSchema } from './toV3Document.ts'

type GenerateSettingsArgs = {
  toGeneratorConfigMap: <EnrichmentType>() => GeneratorsMapContainer<EnrichmentType>
  schema: string
  clientSettings: ClientSettings | undefined
  defaultSelected: boolean
  spanId: string
}

export const generateSettings = async ({
  toGeneratorConfigMap,
  schema,
  clientSettings,
  defaultSelected,
  spanId
}: GenerateSettingsArgs) => {
  const documentObject = await toV3Document(stringToSchema(schema))
  const { oasDocument, extensions } = toOasDocument({ documentObject, spanId })

  const generatorSettings = toSettings({
    generators: Object.values(toGeneratorConfigMap()),
    clientSettings,
    defaultSelected,
    oasDocument
  })

  const enrichedSettings = enrichSettings({ generatorSettings, enrichments: {} })

  return { enrichedSettings, extensions }
}
