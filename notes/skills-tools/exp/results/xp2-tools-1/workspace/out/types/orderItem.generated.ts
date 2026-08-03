import {z} from 'zod'

export const orderItem = z.object({sku: z.string(), quantity: z.number().int(), unitPrice: z.number(), giftWrap: z.boolean().optional()});
