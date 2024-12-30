"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractExtensions = exports.toSpecificationExtensionsV3 = void 0;
const toSpecificationExtensionsV3 = ({ skipped: s, context }) => {
    const { skipped, extensionFields } = (0, exports.extractExtensions)(s);
    context.logSkippedFields(skipped);
    return extensionFields;
};
exports.toSpecificationExtensionsV3 = toSpecificationExtensionsV3;
const extractExtensions = (item) => {
    return Object.entries(item).reduce((acc, [key, value]) => {
        if (!key.startsWith('x-')) {
            return acc;
        }
        const { skipped, extensionFields } = acc;
        const { [key]: _key, ...rest } = skipped;
        return {
            skipped: rest,
            extensionFields: {
                ...(extensionFields ?? {}),
                [key]: value
            }
        };
    }, { skipped: item, extensionFields: undefined });
};
exports.extractExtensions = extractExtensions;
