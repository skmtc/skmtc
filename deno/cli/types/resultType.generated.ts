import { z } from 'zod'

export const resultType = z.enum([
  'success',
  'warning',
  'error',
  'skipped',
  'notSupported',
])
