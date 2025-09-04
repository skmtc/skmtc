import { z } from 'zod'

export const deploymentStatus = z.enum([
  'pending',
  'success',
  'failed',
  'deleted',
])
