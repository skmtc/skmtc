import {z} from 'zod'

export const orderStatus = z.enum(["pending", "paid", "shipped", "cancelled"]);
