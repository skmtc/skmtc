import {z} from 'zod'

export const address = z.object({line1: z.string(), line2: z.string().optional(), city: z.string(), postalCode: z.string(), country: z.string()});
