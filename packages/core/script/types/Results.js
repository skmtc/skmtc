"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resultsItemJsonSchema = exports.resultsItem = exports.resultType = void 0;
require("../_dnt.polyfills.js");
const zod_1 = require("zod");
const zod_to_json_schema_1 = require("zod-to-json-schema");
exports.resultType = zod_1.z.enum(['success', 'warning', 'error', 'notSelected', 'notSupported']);
exports.resultsItem = zod_1.z.record(zod_1.z.lazy(() => zod_1.z.union([exports.resultsItem, exports.resultType, zod_1.z.array(exports.resultsItem.nullable())])));
exports.resultsItemJsonSchema = (0, zod_to_json_schema_1.zodToJsonSchema)(exports.resultsItem, {
    basePath: [`#/components/schemas/ResultsItem`],
    target: 'openApi3',
    strictUnions: true
});
