import {order} from '@/types/order.generated.ts'
import {z} from 'zod'

export class OrdersClient {
  
  async getApiOrders(): Promise<getApiOrdersResponse> {
    const res = await fetch(`/orders`, {
      method: 'get'
    });
    return getApiOrdersResponse.parse(await res.json());
  }


  
  async createApiOrders(body: unknown): Promise<order> {
    const res = await fetch(`/orders`, {
      method: 'post',
      body: JSON.stringify(body)
    });
    return order.parse(await res.json());
  }


  
  async getApiOrdersId(id): Promise<order> {
    const res = await fetch(`/orders/${id}`, {
      method: 'get'
    });
    return order.parse(await res.json());
  }

}

export const getApiOrdersResponse = z.array(order);
