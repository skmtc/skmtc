import type { ParseContext } from '../../context/ParseContext.js';
type ToSpecificationExtensionsV3Args = {
    skipped: Record<string, unknown>;
    context: ParseContext;
};
export declare const toSpecificationExtensionsV3: ({ skipped: s, context }: ToSpecificationExtensionsV3Args) => Record<string, unknown> | undefined;
export declare const extractExtensions: (item: Record<string, unknown>) => {
    skipped: Record<string, unknown>;
    extensionFields: Record<string, unknown> | undefined;
};
export {};
//# sourceMappingURL=toSpecificationExtensionsV3.d.ts.map