"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasIntegerData = void 0;
const zod_1 = require("zod");
exports.oasIntegerData = zod_1.z
    .object({
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    default: zod_1.z.number().int().optional(),
    format: zod_1.z.union([zod_1.z.literal('int32'), zod_1.z.literal('int64')]).optional(),
    enum: zod_1.z.array(zod_1.z.number()).optional(),
    type: zod_1.z.literal('integer'),
    nullable: zod_1.z.boolean().optional(),
    example: zod_1.z.number().int().optional().catch(undefined)
    // Add soon
    // multipleOf: z.number().optional(),
    // maximum: z.number().optional(),
    // exclusiveMaximum: z.boolean().optional(),
    // minimum: z.number().optional(),
    // exclusiveMinimum: z.boolean().optional()
})
    .passthrough();
