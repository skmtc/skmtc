import type { OasRef } from '../ref/Ref.js';
export type VoidFields = {
    title?: string;
    description?: string;
};
/**
 * Object representing a void type in the OpenAPI Specification.
 * It is used to describe an absence of a value such as when no
 * content is returned by an operation.
 */
export declare class OasVoid {
    /**
     * Object is part the 'schema' set which is used
     * to define data types in an OpenAPI document.
     */
    oasType: "schema";
    /**
     * Constant value 'void' useful for type narrowing and tagged unions.
     */
    type: "void";
    /**
     * A short summary of the value.
     */
    title: string | undefined;
    /**
     * A description of the value.
     */
    description: string | undefined;
    constructor(fields?: VoidFields);
    static empty(): OasVoid;
    isRef(): this is OasRef<'schema'>;
    resolve(): OasVoid;
    resolveOnce(): OasVoid;
}
//# sourceMappingURL=Void.d.ts.map