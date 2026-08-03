import {Type} from '@sinclair/typebox'
import {OrderStatus} from '@/models/OrderStatus.generated.ts'
import {OrderItem} from '@/models/OrderItem.generated.ts'
import {Address} from '@/models/Address.generated.ts'

export const Order = Type.Object({id: Type.String(), status: OrderStatus, items: Type.Array(OrderItem), shippingAddress: Address, billingAddress: Type.Optional(Address), notes: Type.Optional(Type.Union([Type.String(), Type.Null()]))});
