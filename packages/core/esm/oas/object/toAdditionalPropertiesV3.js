import { toSchemaV3 } from '../schema/toSchemasV3.js';
export const toAdditionalPropertiesV3 = ({ additionalProperties, context }) => {
    if (typeof additionalProperties === 'boolean') {
        return additionalProperties;
    }
    if (additionalProperties === undefined) {
        return undefined;
    }
    return toSchemaV3({ schema: additionalProperties, context });
};
