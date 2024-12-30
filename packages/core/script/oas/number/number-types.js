"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasNumberData = void 0;
const zod_1 = require("zod");
exports.oasNumberData = zod_1.z.object({
    oasType: zod_1.z.literal('schema'),
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    default: zod_1.z.number().optional(),
    type: zod_1.z.literal('number')
    // Add soon
    // multipleOf: z.number().optional(),
    // maximum: z.number().optional(),
    // exclusiveMaximum: z.boolean().optional(),
    // minimum: z.number().optional(),
    // exclusiveMinimum: z.boolean().optional()
});
