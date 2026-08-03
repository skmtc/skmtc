import {order} from '@/types/order.generated.ts'
import {z} from 'zod'

export class OrdersClient {
    async getApiOrders(): Promise<unknown> {
    const res = await fetch(`/orders`, { method: 'undefined' })
    return getApiOrdersResponse.parse(await res.json())
  }

    async createApiOrders(body: unknown): Promise<unknown> {
    const res = await fetch(`/orders`, { method: 'undefined', body: JSON.stringify(body) })
    return order.parse(await res.json())
  }

    async getApiOrdersId(id: string): Promise<unknown> {
    const res = await fetch(`/orders/${id}`, { method: 'undefined' })
    return order.parse(await res.json())
  }
}

export const getApiOrdersResponse = z.array(order);
