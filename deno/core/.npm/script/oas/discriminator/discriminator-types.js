"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasDiscriminatorData = void 0;
const zod_1 = require("zod");
exports.oasDiscriminatorData = zod_1.z.object({
    oasType: zod_1.z.literal('discriminator'),
    propertyName: zod_1.z.string(),
    mapping: zod_1.z.record(zod_1.z.string()).optional()
});
