import {Type} from '@sinclair/typebox'

export const OrderItem = Type.Object({sku: Type.String(), quantity: Type.Integer(), unitPrice: Type.Number(), giftWrap: Type.Optional(Type.Boolean())});
