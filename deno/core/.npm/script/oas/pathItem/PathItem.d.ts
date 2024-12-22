import type { OasParameter } from '../parameter/Parameter.js';
import type { OasRef } from '../ref/Ref.js';
export type PathItemFields = {
    summary?: string | undefined;
    description?: string | undefined;
    parameters?: (OasParameter | OasRef<'parameter'>)[] | undefined;
    extensionFields?: Record<string, unknown>;
};
export declare class OasPathItem {
    oasType: 'pathItem';
    summary: string | undefined;
    description: string | undefined;
    parameters: (OasParameter | OasRef<'parameter'>)[] | undefined;
    extensionFields: Record<string, unknown> | undefined;
    constructor(fields?: PathItemFields);
}
//# sourceMappingURL=PathItem.d.ts.map