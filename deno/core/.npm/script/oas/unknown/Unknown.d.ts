import type { OasRef } from '../ref/Ref.js';
export type UnknownFields = {
    title?: string;
    description?: string;
    extensionFields?: Record<string, unknown>;
    example?: unknown;
};
/**
 * Object representing an unknown type in the OpenAPI Specification.
 *
 * JSON schema treats a definition without any type information as 'any'.
 * Since this is not useful in an API context, we use OasUnknown to
 * represent types that are not specified.
 */
export declare class OasUnknown {
    /**
     * Object is part the 'schema' set which is used
     * to define data types in an OpenAPI document.
     */
    oasType: "schema";
    /**
     * Constant value 'unknown' useful for type narrowing and tagged unions.
     */
    type: "unknown";
    /**
     * A short summary of the unknown type.
     */
    title: string | undefined;
    /**
     * A description of the unknown type.
     */
    description: string | undefined;
    /** Specification Extension fields */
    extensionFields: Record<string, unknown> | undefined;
    /** An example of the unknown type. */
    example: unknown | undefined;
    constructor(fields: UnknownFields);
    isRef(): this is OasRef<'schema'>;
    resolve(): OasUnknown;
    resolveOnce(): OasUnknown;
}
//# sourceMappingURL=Unknown.d.ts.map