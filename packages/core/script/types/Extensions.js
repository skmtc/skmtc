"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extensions = void 0;
require("../_dnt.polyfills.js");
const zod_1 = require("zod");
exports.extensions = zod_1.z.record(zod_1.z.union([zod_1.z.string(), zod_1.z.lazy(() => exports.extensions)]));
