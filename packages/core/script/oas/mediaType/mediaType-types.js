"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasMediaTypeData = void 0;
const example_types_js_1 = require("../example/example-types.js");
const ref_types_js_1 = require("../ref/ref-types.js");
const schema_types_js_1 = require("../schema/schema-types.js");
const zod_openapi_1 = require("@hono/zod-openapi");
exports.oasMediaTypeData = zod_openapi_1.z.object({
    oasType: zod_openapi_1.z.literal('mediaType'),
    mediaType: zod_openapi_1.z.string(),
    schema: zod_openapi_1.z.union([schema_types_js_1.oasSchemaData, ref_types_js_1.oasSchemaRefData]).optional(),
    // example: z.any().optional(),
    examples: zod_openapi_1.z.record(zod_openapi_1.z.union([example_types_js_1.oasExampleData, ref_types_js_1.oasExampleRefData])).optional()
    // encoding: z.lazy(() => z.record(encoding).optional())
});
