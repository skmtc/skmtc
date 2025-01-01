import { z } from 'zod'
import { method } from '@skmtc/core/Method'

export const generatorsType = z.object({
  generators: z.array(z.string())
})

export const modelGeneratorSettingsType = z.object({
  id: z.string(),
  models: z.record(z.string(), z.object({ selected: z.boolean() }))
})

export const operationGeneratorSettingsType = z.object({
  id: z.string(),
  operations: z.record(
    z.string(),
    z.record(
      method,
      z.object({
        selected: z.boolean(),
        enrichments: z
          .object({
            isPaginated: z.boolean(),
            pathToList: z.string().nullable()
          })
          .optional()
      })
    )
  )
})

export const generatorSettingsType = z.object({
  generators: z.array(z.union([modelGeneratorSettingsType, operationGeneratorSettingsType]))
})

export type GeneratorSettingsType = z.infer<typeof generatorSettingsType>
