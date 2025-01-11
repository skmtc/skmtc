"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasNullData = void 0;
const zod_openapi_1 = require("@hono/zod-openapi");
exports.oasNullData = zod_openapi_1.z.object({
    oasType: zod_openapi_1.z.literal('schema'),
    title: zod_openapi_1.z.string().optional(),
    description: zod_openapi_1.z.string().optional(),
    default: zod_openapi_1.z.null().optional(),
    type: zod_openapi_1.z.literal('null')
});
