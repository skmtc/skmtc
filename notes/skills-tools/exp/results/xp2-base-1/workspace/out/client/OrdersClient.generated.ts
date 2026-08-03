import {order} from '@/types/order.generated.ts'
import {z} from 'zod'

export const getOrdersResponse = z.array(order);

export class OrdersClient {
constructor(private baseUrl: string) {}

async getOrders() {const res = await fetch(`${this.baseUrl}/orders`);
return getOrdersResponse.parse(await res.json());}

async postOrders(body: z.infer<typeof order>) {const res = await fetch(`${this.baseUrl}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
return order.parse(await res.json());}

async getOrdersId(id: string) {const res = await fetch(`${this.baseUrl}/orders/${id}`);
return order.parse(await res.json());}
}
