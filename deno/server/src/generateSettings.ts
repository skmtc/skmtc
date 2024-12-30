import { toSettings, enrichSettings, CoreContext } from '@skmtc/core'
import type { GeneratorsType } from './types.ts'
import type { ClientSettings, ParseReturn } from '@skmtc/core'
import * as core from '@skmtc/core'

type GenerateSettingsArgs = {
  generators: GeneratorsType
  schema: string
  clientSettings: ClientSettings | undefined
  defaultSelected: boolean
  spanId: string
}

export const generateSettings = async ({
  generators,
  schema,
  clientSettings,
  defaultSelected,
  spanId
}: GenerateSettingsArgs) => {
  const { oasDocument, extensions } = toOasDocument({ schema, spanId })

  const generatorSettings = toSettings({
    generators,
    clientSettings,
    defaultSelected,
    oasDocument
  })

  console.log('TO ENRICHMENTS', core.toEnrichments)

  const enrichments = await core.toEnrichments({ generators, oasDocument })

  console.log('ENRICHMENTS X', JSON.stringify(enrichments, null, 2))

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
