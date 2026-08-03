import {order} from '@/types/order.generated.ts'
import {z} from 'zod'

export class OrdersClient {
/**
 * List orders
 */
async getOrders() {const res = await fetch(`/orders`)
return getOrdersResponse.parse(await res.json())}

/**
 * Create an order
 */
async postOrders(body: z.infer<typeof order>) {const res = await fetch(`/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
return order.parse(await res.json())}

/**
 * Get one order
 */
async getOrdersId(id: string) {const res = await fetch(`/orders/${id}`)
return order.parse(await res.json())}
}

export const getOrdersResponse = z.array(order);
