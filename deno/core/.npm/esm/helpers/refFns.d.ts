import type { RefName } from '../types/RefName.js';
export declare const toRefName: ($ref: string) => RefName;
type Ref = {
    $ref: string;
};
export declare const isRef: (value: unknown) => value is Ref;
export {};
//# sourceMappingURL=refFns.d.ts.map