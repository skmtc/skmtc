import {Schema} from 'effect'

export const OrderStatus = Schema.Literal('pending', 'paid', 'shipped', 'cancelled');
