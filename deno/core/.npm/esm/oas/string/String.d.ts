import type { OasRef } from '../ref/Ref.js';
export type StringFields = {
    title?: string;
    description?: string;
    format?: string;
    enums?: string[];
    maxLength?: number;
    minLength?: number;
    nullable?: boolean;
    extensionFields?: Record<string, unknown>;
    example?: string;
};
/**
 * Object representing a string in the OpenAPI Specification.
 */
export declare class OasString {
    /**
     * Object is part the 'schema' set which is used
     * to define data types in an OpenAPI document.
     */
    oasType: "schema";
    /**
     * Constant value 'string' useful for type narrowing and tagged unions.
     */
    type: "string";
    /**
     * A short summary of the string.
     */
    title: string | undefined;
    /**
     * A description of the string.
     */
    description: string | undefined;
    /**
     * The format of the string.
     */
    format: string | undefined;
    /**
     * An array of allowed values for the string.
     */
    enums: string[] | undefined;
    /**
     * The maximum length of the string.
     */
    maxLength: number | undefined;
    /**
     * The minimum length of the string.
     */
    minLength: number | undefined;
    /**
     * Indicates whether value can be null.
     */
    nullable: boolean | undefined;
    /** Specification Extension fields */
    extensionFields: Record<string, unknown> | undefined;
    /** An example of the string. */
    example: string | undefined;
    constructor(fields: StringFields);
    isRef(): this is OasRef<'schema'>;
    resolve(): OasString;
    resolveOnce(): OasString;
}
//# sourceMappingURL=String.d.ts.map