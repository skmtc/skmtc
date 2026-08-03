import {Schema} from 'effect'
import {OrderStatus} from '@/models/OrderStatus.generated.ts'
import {OrderItem} from '@/models/OrderItem.generated.ts'
import {Address} from '@/models/Address.generated.ts'

export const Order = Schema.Struct({
id: Schema.String,
status: OrderStatus,
items: Schema.Array(OrderItem),
shippingAddress: Address,
billingAddress: Schema.optional(Address),
notes: Schema.optional(Schema.NullOr(Schema.String))
});
