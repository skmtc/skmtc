import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.js';
import type { OasRef } from '../ref/Ref.js';
import type { OpenAPIV3 } from 'openapi-types';
export type ArrayFields = {
    items: OasSchema | OasRef<'schema'>;
    title?: string;
    description?: string;
    nullable?: boolean;
    uniqueItems?: boolean;
    extensionFields?: Record<string, unknown>;
    example?: Array<any>;
};
/**
 * Object representing an array in the OpenAPI Specification.
 */
export declare class OasArray {
    /**
     * Object is part the 'schema' set which is used
     * to define data types in an OpenAPI document.
     */
    oasType: "schema";
    /**
     * Constant value 'array' useful for type narrowing and tagged unions.
     */
    type: "array";
    /**
     * Defines the type of items in the array.
     */
    items: OasSchema | OasRef<'schema'>;
    /**
     * A short summary of the array.
     */
    title: string | undefined;
    /**
     * A description of the array.
     */
    description: string | undefined;
    /**
     * Indicates whether value can be null.
     */
    nullable: boolean | undefined;
    /**
     * Indicates whether the array items must be unique.
     */
    uniqueItems: boolean | undefined;
    /** Specification Extension fields */
    extensionFields: Record<string, unknown> | undefined;
    /**
     * An example of the array.
     */
    example: Array<unknown> | undefined;
    constructor(fields: ArrayFields);
    isRef(): this is OasRef<'schema'>;
    resolve(): OasArray;
    resolveOnce(): OasArray;
    toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.SchemaObject;
}
//# sourceMappingURL=Array.d.ts.map