import {Schema} from 'effect'

export const OrderItem = Schema.Struct({
  sku: Schema.String,
  quantity: Schema.Number,
  unitPrice: Schema.Number,
  giftWrap: Schema.optional(Schema.Boolean)
});
