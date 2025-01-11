"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasIntersectionData = void 0;
const zod_openapi_1 = require("@hono/zod-openapi");
const schema_types_js_1 = require("../schema/schema-types.js");
const ref_types_js_1 = require("../ref/ref-types.js");
const discriminator_types_js_1 = require("../discriminator/discriminator-types.js");
exports.oasIntersectionData = zod_openapi_1.z.object({
    oasType: zod_openapi_1.z.literal('schema'),
    type: zod_openapi_1.z.literal('intersection'),
    title: zod_openapi_1.z.string().optional(),
    description: zod_openapi_1.z.string().optional(),
    members: zod_openapi_1.z.lazy(() => zod_openapi_1.z.array(zod_openapi_1.z.union([schema_types_js_1.oasSchemaData, ref_types_js_1.oasSchemaRefData]))),
    discriminator: discriminator_types_js_1.oasDiscriminatorData.optional()
});
