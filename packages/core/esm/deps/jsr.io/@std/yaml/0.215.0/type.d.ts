import type { Any, ArrayObject } from "./_utils.js";
export type KindType = "sequence" | "scalar" | "mapping";
export type StyleVariant = "lowercase" | "uppercase" | "camelcase" | "decimal";
export type RepresentFn = (data: Any, style?: StyleVariant) => Any;
interface TypeOptions {
    kind: KindType;
    resolve?: (data: Any) => boolean;
    construct?: (data: string) => Any;
    instanceOf?: Any;
    predicate?: (data: Record<string, unknown>) => boolean;
    represent?: RepresentFn | ArrayObject<RepresentFn>;
    defaultStyle?: StyleVariant;
    styleAliases?: ArrayObject;
}
export declare class Type {
    tag: string;
    kind: KindType | null;
    instanceOf: Any;
    predicate?: (data: Record<string, unknown>) => boolean;
    represent?: RepresentFn | ArrayObject<RepresentFn>;
    defaultStyle?: StyleVariant;
    styleAliases?: ArrayObject;
    loadKind?: KindType;
    constructor(tag: string, options?: TypeOptions);
    resolve: (data?: Any) => boolean;
    construct: (data?: Any) => Any;
}
export {};
//# sourceMappingURL=type.d.ts.map