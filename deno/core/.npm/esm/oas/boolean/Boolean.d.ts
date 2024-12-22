import type { OasRef } from '../ref/Ref.js';
export type BooleanFields = {
    title?: string;
    description?: string;
    nullable?: boolean;
    extensionFields?: Record<string, unknown>;
    example?: boolean;
};
/**
 * Object representing a boolean in the OpenAPI Specification.
 */
export declare class OasBoolean {
    /**
     * Object is part the 'schema' set which is used
     * to define data types in an OpenAPI document.
     */
    oasType: "schema";
    /**
     * Constant value 'boolean' useful for type narrowing and tagged unions.
     */
    type: "boolean";
    /**
     * A short summary of the boolean.
     */
    title: string | undefined;
    /**
     * A description of the boolean.
     */
    description: string | undefined;
    /**
     * Indicates whether value can be null.
     */
    nullable: boolean | undefined;
    /** Specification Extension fields */
    extensionFields: Record<string, unknown> | undefined;
    /**
     * An example of the boolean.
     */
    example: boolean | undefined;
    constructor(fields: BooleanFields);
    isRef(): this is OasRef<'schema'>;
    resolve(): OasBoolean;
    resolveOnce(): OasBoolean;
}
//# sourceMappingURL=Boolean.d.ts.map