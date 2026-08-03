import {Type} from '@sinclair/typebox'

export const OrderStatus = Type.Union([Type.Literal('pending'), Type.Literal('paid'), Type.Literal('shipped'), Type.Literal('cancelled')]);
