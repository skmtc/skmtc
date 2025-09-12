import { z } from 'zod'

export const schemaFormat = z.enum(['json', 'yaml'])
