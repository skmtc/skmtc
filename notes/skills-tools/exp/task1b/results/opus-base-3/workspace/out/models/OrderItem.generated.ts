import {Schema} from 'effect'

export const OrderItem = Schema.Struct({
sku: Schema.String,
quantity: Schema.Int,
unitPrice: Schema.Number,
giftWrap: Schema.optional(Schema.Boolean)
});
