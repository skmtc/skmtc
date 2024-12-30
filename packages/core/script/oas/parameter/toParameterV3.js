"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toOptionalParametersV3 = exports.toParametersV3 = exports.toParameterListV3 = void 0;
const refFns_js_1 = require("../../helpers/refFns.js");
const parameter_types_js_1 = require("./parameter-types.js");
const toExamplesV3_js_1 = require("../example/toExamplesV3.js");
const toRefV31_js_1 = require("../ref/toRefV31.js");
const toSchemasV3_js_1 = require("../schema/toSchemasV3.js");
const toMediaTypeItemV3_js_1 = require("../mediaType/toMediaTypeItemV3.js");
const Parameter_js_1 = require("./Parameter.js");
const ts_pattern_1 = require("ts-pattern");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toParameterListV3 = ({ parameters, context }) => {
    if (!parameters) {
        return undefined;
    }
    return parameters.map((parameter, index) => {
        return context.trace(`${index}`, () => toParameterV3({ parameter, context }));
    });
};
exports.toParameterListV3 = toParameterListV3;
const toParametersV3 = ({ parameters, context }) => {
    return Object.fromEntries(Object.entries(parameters).map(([key, value]) => {
        return [key, context.trace(key, () => toParameterV3({ parameter: value, context }))];
    }));
};
exports.toParametersV3 = toParametersV3;
const toOptionalParametersV3 = ({ parameters, context }) => {
    if (!parameters) {
        return undefined;
    }
    return (0, exports.toParametersV3)({ parameters, context });
};
exports.toOptionalParametersV3 = toOptionalParametersV3;
const toParameterV3 = ({ parameter, context }) => {
    if ((0, refFns_js_1.isRef)(parameter)) {
        return (0, toRefV31_js_1.toRefV31)({ ref: parameter, refType: 'parameter', context });
    }
    const { name, in: location, description, required, deprecated, allowEmptyValue, allowReserved, schema, example, examples, content, style, explode, ...skipped } = parameter;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    const parsedLocation = parameter_types_js_1.oasParameterLocation.parse(location);
    if (parsedLocation === 'path' && !required) {
        console.warn(`Path parameters must be required`);
    }
    // Set missing 'required' to true for path parameters and false for others
    const defaultRequired = typeof required === 'undefined' ? (parsedLocation === 'path' ? true : false) : required;
    const fields = {
        name,
        location: parsedLocation,
        description,
        required: defaultRequired,
        deprecated,
        style: context.trace('style', () => toStyle({ style, location: parsedLocation })),
        explode: context.trace('explode', () => toExplode({ explode, style })),
        allowEmptyValue,
        allowReserved,
        schema: context.trace('schema', () => (0, toSchemasV3_js_1.toOptionalSchemaV3)({ schema, context })),
        examples: context.trace('examples', () => (0, toExamplesV3_js_1.toExamplesV3)({
            examples,
            example,
            exampleKey: `${name}-${parsedLocation}`,
            context
        })),
        content: context.trace('content', () => (0, toMediaTypeItemV3_js_1.toOptionalMediaTypeItemsV3)({ content, context })),
        extensionFields
    };
    return new Parameter_js_1.OasParameter(fields);
};
const toStyle = ({ style, location }) => {
    const parsed = parameter_types_js_1.oasParameterStyle.optional().parse(style);
    return (parsed ??
        (0, ts_pattern_1.match)(location)
            .with('path', () => 'simple')
            .with('header', () => 'simple')
            .with('query', () => 'form')
            .with('cookie', () => 'form')
            .exhaustive());
};
const toExplode = ({ explode, style }) => {
    return (explode ??
        (0, ts_pattern_1.match)(style)
            .with('form', () => true)
            .otherwise(() => false));
};
