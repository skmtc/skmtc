"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasUnknownData = void 0;
const zod_1 = require("zod");
exports.oasUnknownData = zod_1.z.object({
    oasType: zod_1.z.literal('schema'),
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    default: zod_1.z.unknown().optional(),
    type: zod_1.z.literal('unknown')
});
