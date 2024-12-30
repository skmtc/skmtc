import { isRef } from '../../helpers/refFns.js';
import { oasParameterLocation, oasParameterStyle } from './parameter-types.js';
import { toExamplesV3 } from '../example/toExamplesV3.js';
import { toRefV31 } from '../ref/toRefV31.js';
import { toOptionalSchemaV3 } from '../schema/toSchemasV3.js';
import { toOptionalMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.js';
import { OasParameter } from './Parameter.js';
import { match } from 'ts-pattern';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toParameterListV3 = ({ parameters, context }) => {
    if (!parameters) {
        return undefined;
    }
    return parameters.map((parameter, index) => {
        return context.trace(`${index}`, () => toParameterV3({ parameter, context }));
    });
};
export const toParametersV3 = ({ parameters, context }) => {
    return Object.fromEntries(Object.entries(parameters).map(([key, value]) => {
        return [key, context.trace(key, () => toParameterV3({ parameter: value, context }))];
    }));
};
export const toOptionalParametersV3 = ({ parameters, context }) => {
    if (!parameters) {
        return undefined;
    }
    return toParametersV3({ parameters, context });
};
const toParameterV3 = ({ parameter, context }) => {
    if (isRef(parameter)) {
        return toRefV31({ ref: parameter, refType: 'parameter', context });
    }
    const { name, in: location, description, required, deprecated, allowEmptyValue, allowReserved, schema, example, examples, content, style, explode, ...skipped } = parameter;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    const parsedLocation = oasParameterLocation.parse(location);
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
        schema: context.trace('schema', () => toOptionalSchemaV3({ schema, context })),
        examples: context.trace('examples', () => toExamplesV3({
            examples,
            example,
            exampleKey: `${name}-${parsedLocation}`,
            context
        })),
        content: context.trace('content', () => toOptionalMediaTypeItemsV3({ content, context })),
        extensionFields
    };
    return new OasParameter(fields);
};
const toStyle = ({ style, location }) => {
    const parsed = oasParameterStyle.optional().parse(style);
    return (parsed ??
        match(location)
            .with('path', () => 'simple')
            .with('header', () => 'simple')
            .with('query', () => 'form')
            .with('cookie', () => 'form')
            .exhaustive());
};
const toExplode = ({ explode, style }) => {
    return (explode ??
        match(style)
            .with('form', () => true)
            .otherwise(() => false));
};
