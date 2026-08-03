import {getOrdersResponse} from '@/types/getOrdersResponse.generated.ts'
import {order} from '@/types/order.generated.ts'
import {z} from 'zod'

export class OrdersClient {
  async getOrders() {
    const res = await fetch(`/orders`, {
      method: 'GET'
    })

    if (!res.ok) {
      throw new Error(await res.text())
    }

    return getOrdersResponse.parse(await res.json())
  }

  async postOrders(body: z.infer<typeof order>) {
    const res = await fetch(`/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      throw new Error(await res.text())
    }

    return order.parse(await res.json())
  }

  async getOrdersId(id: string) {
    const res = await fetch(`/orders/${id}`, {
      method: 'GET'
    })

    if (!res.ok) {
      throw new Error(await res.text())
    }

    return order.parse(await res.json())
  }
}
