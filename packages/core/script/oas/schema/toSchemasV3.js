"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toOptionalSchemaV3 = exports.toSchemaV3 = exports.toOptionalSchemasV3 = exports.toSchemasV3 = void 0;
const toRefV31_js_1 = require("../ref/toRefV31.js");
const refFns_js_1 = require("../../helpers/refFns.js");
const ts_pattern_1 = require("ts-pattern");
const toArray_js_1 = require("../array/toArray.js");
const toObject_js_1 = require("../object/toObject.js");
const toInteger_js_1 = require("../integer/toInteger.js");
const toNumber_js_1 = require("../number/toNumber.js");
const toBoolean_js_1 = require("../boolean/toBoolean.js");
const toString_js_1 = require("../string/toString.js");
const toUnknown_js_1 = require("../unknown/toUnknown.js");
const toUnion_js_1 = require("../union/toUnion.js");
const toIntersection_js_1 = require("../intersection/toIntersection.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toSchemasV3 = ({ schemas, context, childOfComponents }) => {
    return Object.fromEntries(Object.entries(schemas).map(([key, schema]) => {
        return [
            key,
            context.trace(key, () => {
                const { extensionFields } = (0, toSpecificationExtensionsV3_js_1.extractExtensions)(schema);
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
                return (0, exports.toSchemaV3)({ schema, context });
            })
        ];
    }));
};
exports.toSchemasV3 = toSchemasV3;
const toOptionalSchemasV3 = ({ schemas, context, childOfComponents }) => {
    if (!schemas) {
        return undefined;
    }
    return (0, exports.toSchemasV3)({ schemas, context, childOfComponents });
};
exports.toOptionalSchemasV3 = toOptionalSchemasV3;
const toSchemaV3 = ({ schema, context }) => {
    if ((0, refFns_js_1.isRef)(schema)) {
        return (0, toRefV31_js_1.toRefV31)({ ref: schema, refType: 'schema', context });
    }
    // Workaround for dodgy Reapit schema
    // if (schema.type !== 'array' && 'optional' in schema && schema.optional === true) {
    //   schema.nullable = true
    // }
    return (0, ts_pattern_1.match)(schema)
        .with({ oneOf: ts_pattern_1.P.array() }, ({ oneOf: members, ...value }) => {
        // if (members.length === 1) {
        //   return toSchemaV3({ schema: members[0], context })
        // }
        return (0, toUnion_js_1.toUnion)({ value, members, context });
    })
        .with({ anyOf: ts_pattern_1.P.array() }, ({ anyOf: members, ...value }) => {
        // if (members.length === 1) {
        //   return toSchemaV3({ schema: members[0], context })
        // }
        return context.trace('anyOf', () => (0, toUnion_js_1.toUnion)({ value, members, context }));
    })
        .with({ allOf: ts_pattern_1.P.array() }, ({ allOf: members, ...value }) => {
        // if (members.length === 1) {
        //   return toSchemaV3({ schema: members[0], context })
        // }
        return context.trace('allOf', () => (0, toIntersection_js_1.toIntersection)({ value, members, context }));
    })
        .with({ type: 'object' }, value => (0, toObject_js_1.toObject)({ value, context }))
        .with({ type: 'array' }, value => (0, toArray_js_1.toArray)({ value, context }))
        .with({ type: 'integer' }, value => (0, toInteger_js_1.toInteger)({ value, context }))
        .with({ type: 'number' }, value => (0, toNumber_js_1.toNumber)({ value, context }))
        .with({ type: 'boolean' }, value => (0, toBoolean_js_1.toBoolean)({ value, context }))
        .with({ type: 'string' }, value => (0, toString_js_1.toString)({ value, context }))
        .otherwise(value => (0, toUnknown_js_1.toUnknown)({ value, context }));
};
exports.toSchemaV3 = toSchemaV3;
const toOptionalSchemaV3 = ({ schema, context }) => {
    if (!schema) {
        return undefined;
    }
    return (0, exports.toSchemaV3)({ schema, context });
};
exports.toOptionalSchemaV3 = toOptionalSchemaV3;
