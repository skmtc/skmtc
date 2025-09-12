import { z } from 'zod'

export const openApiVersion = z.enum(['2.0', '3.0', '3.1'])
