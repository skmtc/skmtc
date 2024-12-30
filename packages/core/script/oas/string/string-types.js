"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasStringData = exports.stringFormat = void 0;
const zod_1 = require("zod");
exports.stringFormat = zod_1.z.enum([
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
exports.oasStringData = zod_1.z
    .object({
    type: zod_1.z.literal('string'),
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    default: zod_1.z.string().optional(),
    maxLength: zod_1.z.number().optional(),
    minLength: zod_1.z.number().optional(),
    pattern: zod_1.z.string().optional(),
    enum: zod_1.z.array(zod_1.z.string()).optional(),
    format: zod_1.z.string().optional(),
    nullable: zod_1.z.boolean().optional(),
    example: zod_1.z.string().optional().catch(undefined)
})
    .passthrough();
