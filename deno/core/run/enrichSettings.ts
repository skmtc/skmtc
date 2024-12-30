import { set } from 'lodash-es'
import type { ClientGeneratorSettings } from '../types/Settings.ts'
import type { EnrichmentItem } from './toEnrichments.ts'

type EnrichSettingsArgs = {
  generatorSettings: ClientGeneratorSettings[]
  enrichments: Record<string, EnrichmentItem[]>
}

export const enrichSettings = ({ generatorSettings, enrichments }: EnrichSettingsArgs) => {
  Object.values(generatorSettings).forEach(setting => {
    Object.values(enrichments[setting.id] ?? {}).forEach(({ key, value }) => {
      set(setting, key, value)
    })
  })

  return generatorSettings
}
