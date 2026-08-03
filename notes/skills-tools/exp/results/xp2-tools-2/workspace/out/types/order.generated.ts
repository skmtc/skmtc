import {z} from 'zod'
import {orderStatus} from '@/types/orderStatus.generated.ts'
import {orderItem} from '@/types/orderItem.generated.ts'
import {address} from '@/types/address.generated.ts'

export const order = z.object({id: z.string(), status: orderStatus, items: z.array(orderItem), shippingAddress: address, billingAddress: address.optional(), notes: z.string().nullable().optional()});
