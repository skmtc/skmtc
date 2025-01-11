"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasStringData = exports.stringFormat = void 0;
const zod_openapi_1 = require("@hono/zod-openapi");
exports.stringFormat = zod_openapi_1.z.enum([
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
exports.oasStringData = zod_openapi_1.z
    .object({
    type: zod_openapi_1.z.literal('string'),
    title: zod_openapi_1.z.string().optional(),
    description: zod_openapi_1.z.string().optional(),
    default: zod_openapi_1.z.string().optional(),
    maxLength: zod_openapi_1.z.number().optional(),
    minLength: zod_openapi_1.z.number().optional(),
    pattern: zod_openapi_1.z.string().optional(),
    enum: zod_openapi_1.z.array(zod_openapi_1.z.string()).optional(),
    format: zod_openapi_1.z.string().optional(),
    nullable: zod_openapi_1.z.boolean().optional(),
    example: zod_openapi_1.z.string().optional().catch(undefined)
})
    .passthrough();
