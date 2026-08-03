import {order} from '@/types/order.generated.ts'
import {z} from 'zod'

export class OrdersClient {
    async getApiOrders() {
    const res = await fetch(`/orders`, { method: 'get' })
    return getApiOrdersResponse.parse(await res.json())
  }

    async createApiOrders(body: unknown) {
    const res = await fetch(`/orders`, { method: 'post', body: JSON.stringify(body) })
    return order.parse(await res.json())
  }

    async getApiOrdersId(id: string) {
    const res = await fetch(`/orders/${id}`, { method: 'get' })
    return order.parse(await res.json())
  }
}

export const getApiOrdersResponse = z.array(order);
