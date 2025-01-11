"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasUnknownData = void 0;
const zod_openapi_1 = require("@hono/zod-openapi");
exports.oasUnknownData = zod_openapi_1.z.object({
    oasType: zod_openapi_1.z.literal('schema'),
    title: zod_openapi_1.z.string().optional(),
    description: zod_openapi_1.z.string().optional(),
    default: zod_openapi_1.z.unknown().optional(),
    type: zod_openapi_1.z.literal('unknown')
});
