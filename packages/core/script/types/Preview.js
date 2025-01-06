"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preview = void 0;
const zod_1 = require("zod");
exports.preview = zod_1.z.object({
    importName: zod_1.z.string(),
    importPath: zod_1.z.string(),
    group: zod_1.z.string(),
    route: zod_1.z.string().optional()
});
