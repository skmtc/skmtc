import { toRefV31 } from '../ref/toRefV31.js';
import { isRef } from '../../helpers/refFns.js';
import { match, P } from 'ts-pattern';
import { toArray } from '../array/toArray.js';
import { toObject } from '../object/toObject.js';
import { toInteger } from '../integer/toInteger.js';
import { toNumber } from '../number/toNumber.js';
import { toBoolean } from '../boolean/toBoolean.js';
import { toString } from '../string/toString.js';
import { toUnknown } from '../unknown/toUnknown.js';
import { toUnion } from '../union/toUnion.js';
import { toIntersection } from '../intersection/toIntersection.js';
import { extractExtensions } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toSchemasV3 = ({ schemas, context, childOfComponents }) => {
    return Object.fromEntries(Object.entries(schemas).map(([key, schema]) => {
        return [
            key,
            context.trace(key, () => {
                const { extensionFields } = extractExtensions(schema);
                if (childOfComponents) {
                    context.registerExtension({
                        extensionFields: {
                            Label: extensionFields?.['x-label'] ?? '',
                            Description: extensionFields?.['x-description'] ?? ''
                        },
                        stackTrail: ['models', key],
                        type: 'schema'
                    });
                }
                else {
                    const parentObject = context.stackTrail.getParentOf(key);
                    if (!parentObject) {
                        throw new Error(`Expected to find parent object for '${key}'`);
                    }
                    context.registerExtension({
                        extensionFields: {
                            Label: extensionFields?.['x-label'] ?? ''
                        },
                        stackTrail: ['models', parentObject, key],
                        type: 'schema'
                    });
                }
                return toSchemaV3({ schema, context });
            })
        ];
    }));
};
export const toOptionalSchemasV3 = ({ schemas, context, childOfComponents }) => {
    if (!schemas) {
        return undefined;
    }
    return toSchemasV3({ schemas, context, childOfComponents });
};
export const toSchemaV3 = ({ schema, context }) => {
    if (isRef(schema)) {
        return toRefV31({ ref: schema, refType: 'schema', context });
    }
    // Workaround for dodgy Reapit schema
    // if (schema.type !== 'array' && 'optional' in schema && schema.optional === true) {
    //   schema.nullable = true
    // }
    return match(schema)
        .with({ oneOf: P.array() }, ({ oneOf: members, ...value }) => {
        // if (members.length === 1) {
        //   return toSchemaV3({ schema: members[0], context })
        // }
        return toUnion({ value, members, context });
    })
        .with({ anyOf: P.array() }, ({ anyOf: members, ...value }) => {
        // if (members.length === 1) {
        //   return toSchemaV3({ schema: members[0], context })
        // }
        return context.trace('anyOf', () => toUnion({ value, members, context }));
    })
        .with({ allOf: P.array() }, ({ allOf: members, ...value }) => {
        // if (members.length === 1) {
        //   return toSchemaV3({ schema: members[0], context })
        // }
        return context.trace('allOf', () => toIntersection({ value, members, context }));
    })
        .with({ type: 'object' }, value => toObject({ value, context }))
        .with({ type: 'array' }, value => toArray({ value, context }))
        .with({ type: 'integer' }, value => toInteger({ value, context }))
        .with({ type: 'number' }, value => toNumber({ value, context }))
        .with({ type: 'boolean' }, value => toBoolean({ value, context }))
        .with({ type: 'string' }, value => toString({ value, context }))
        .otherwise(value => toUnknown({ value, context }));
};
export const toOptionalSchemaV3 = ({ schema, context }) => {
    if (!schema) {
        return undefined;
    }
    return toSchemaV3({ schema, context });
};
