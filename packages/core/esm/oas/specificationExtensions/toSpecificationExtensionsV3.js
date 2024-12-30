export const toSpecificationExtensionsV3 = ({ skipped: s, context }) => {
    const { skipped, extensionFields } = extractExtensions(s);
    context.logSkippedFields(skipped);
    return extensionFields;
};
export const extractExtensions = (item) => {
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
