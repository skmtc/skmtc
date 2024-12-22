import type { OasRef } from '../ref/Ref.js';
export type NumberFields = {
    title?: string;
    description?: string;
    nullable?: boolean;
    extensionFields?: Record<string, unknown>;
    example?: number;
};
/**
 * Object representing a number in the OpenAPI Specification.
 */
export declare class OasNumber {
    /**
     * Object is part the 'schema' set which is used
     * to define data types in an OpenAPI document.
     */
    oasType: "schema";
    /**
     * Constant value 'number' useful for type narrowing and tagged unions.
     */
    type: "number";
    /**
     * A short summary of the number.
     */
    title: string | undefined;
    /**
     * A description of the number.
     */
    description: string | undefined;
    /**
     * Indicates whether value can be null.
     */
    nullable: boolean | undefined;
    /** Specification Extension fields */
    extensionFields: Record<string, unknown> | undefined;
    /**
     * An example of the number.
     */
    example: number | undefined;
    constructor(fields: NumberFields);
    isRef(): this is OasRef<'schema'>;
    resolve(): OasNumber;
    resolveOnce(): OasNumber;
}
//# sourceMappingURL=Number.d.ts.map