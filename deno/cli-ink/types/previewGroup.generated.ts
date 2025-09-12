import { z } from 'zod'

export const previewGroup = z.enum(['forms', 'tables', 'inputs'])
