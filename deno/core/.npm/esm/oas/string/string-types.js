import { z } from 'zod';
export const stringFormat = z.enum([
    'date-time',
    'time',
    'date',
    'duration',
    'email',
    'hostname',
    'ipv4',
    'ipv6',
    'uuid',
    'uri',
    'regex',
    'password',
    'byte',
    'binary'
]);
export const oasStringData = z
    .object({
    type: z.literal('string'),
    title: z.string().optional(),
    description: z.string().optional(),
    default: z.string().optional(),
    maxLength: z.number().optional(),
    minLength: z.number().optional(),
    pattern: z.string().optional(),
    enum: z.array(z.string()).optional(),
    format: z.string().optional(),
    nullable: z.boolean().optional(),
    example: z.string().optional().catch(undefined)
})
    .passthrough();
