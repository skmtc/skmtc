"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAdditionalPropertiesV3 = void 0;
const toSchemasV3_js_1 = require("../schema/toSchemasV3.js");
const toAdditionalPropertiesV3 = ({ additionalProperties, context }) => {
    if (typeof additionalProperties === 'boolean') {
        return additionalProperties;
    }
    if (additionalProperties === undefined) {
        return undefined;
    }
    return (0, toSchemasV3_js_1.toSchemaV3)({ schema: additionalProperties, context });
};
exports.toAdditionalPropertiesV3 = toAdditionalPropertiesV3;
