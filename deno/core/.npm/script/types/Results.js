"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resultsItem = exports.resultType = void 0;
require("../_dnt.polyfills.js");
const zod_1 = require("zod");
exports.resultType = zod_1.z.enum(['success', 'warning', 'error', 'notSelected', 'notSupported']);
exports.resultsItem = zod_1.z.record(zod_1.z.lazy(() => zod_1.z.union([exports.resultsItem, exports.resultType, zod_1.z.array(exports.resultsItem.nullable())])));
