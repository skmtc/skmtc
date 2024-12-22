"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasObjectData = void 0;
const zod_1 = require("zod");
const schema_types_js_1 = require("../schema/schema-types.js");
const ref_types_js_1 = require("../ref/ref-types.js");
exports.oasObjectData = zod_1.z.object({
    oasType: zod_1.z.literal('schema'),
    type: zod_1.z.literal('object'),
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    default: zod_1.z.object({}).optional(),
    // Add soon
    // maxProperties: z.number().optional(),
    // Add soon
    // minProperties: z.number().optional(),
    properties: zod_1.z.lazy(() => {
        return zod_1.z.record(zod_1.z.union([schema_types_js_1.oasSchemaData, ref_types_js_1.oasSchemaRefData])).optional();
    }),
    // Add soon
    // patternProperties: z.lazy(() => z.record(jsonSchema4).optional()),
    required: zod_1.z.array(zod_1.z.string()).optional(),
    // allOf: z.lazy(() => z.array(oasObject).optional()),
    // Use oneOf instead of anyOf
    // anyOf: z.lazy(() => z.array(jsonSchema4).optional()),
    // oneOf: z.lazy(() => z.array(oasObject).optional()),
    additionalProperties: zod_1.z.lazy(() => {
        return zod_1.z.union([zod_1.z.boolean(), schema_types_js_1.oasSchemaData, ref_types_js_1.oasSchemaRefData]).optional();
    })
});
