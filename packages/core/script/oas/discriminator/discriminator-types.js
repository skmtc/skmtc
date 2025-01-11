"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasDiscriminatorData = void 0;
const zod_openapi_1 = require("@hono/zod-openapi");
exports.oasDiscriminatorData = zod_openapi_1.z.object({
    oasType: zod_openapi_1.z.literal('discriminator'),
    propertyName: zod_openapi_1.z.string(),
    mapping: zod_openapi_1.z.record(zod_openapi_1.z.string()).optional()
});
