import { set } from 'lodash-es'
import type { ClientGeneratorSettings } from '../types/Settings.ts'

type EnrichSettingsArgs = {
  generatorSettings: ClientGeneratorSettings[]
  enrichments: Record<string, Record<string, unknown>>
}

export const enrichSettings = ({ generatorSettings, enrichments }: EnrichSettingsArgs) => {
  Object.values(generatorSettings).forEach(setting => {
    Object.entries(enrichments[setting.id] ?? {}).forEach(([key, value]) => {
      console.log('KEY', key)
      set(setting, key, value)
    })
  })

  return generatorSettings
}
