import {order} from '@/types/order.generated.ts'
import {z} from 'zod'

export const getOrdersResponse = z.array(order);
