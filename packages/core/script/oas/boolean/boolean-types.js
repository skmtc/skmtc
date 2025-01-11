"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasBooleanData = void 0;
const zod_openapi_1 = require("@hono/zod-openapi");
exports.oasBooleanData = zod_openapi_1.z.object({
    oasType: zod_openapi_1.z.literal('schema'),
    title: zod_openapi_1.z.string().optional(),
    description: zod_openapi_1.z.string().optional(),
    default: zod_openapi_1.z.boolean().optional(),
    type: zod_openapi_1.z.literal('boolean')
});
