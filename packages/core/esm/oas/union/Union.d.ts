import type { OasDiscriminator } from '../discriminator/Discriminator.js';
import type { OasSchema } from '../schema/Schema.js';
import type { OasRef } from '../ref/Ref.js';
import type { ToJsonSchemaOptions } from '../schema/Schema.js';
import type { OpenAPIV3 } from 'openapi-types';
export type UnionFields = {
    title?: string;
    description?: string;
    nullable?: boolean;
    discriminator?: OasDiscriminator;
    example?: unknown;
    members: (OasSchema | OasRef<'schema'>)[];
    extensionFields?: Record<string, unknown>;
};
/**
 * Object representing a 'oneOf' or 'anyOf' in the OpenAPI Specification.
 *
 * In the context of TypeScript 'anyOf' is not helpful since it implies
 * a union that consists of all possible combinations of member types.
 *
 * Generating such combination types would not be useful and we map both
 * 'oneOf' and 'anyOf' to a TypeScript union type.
 */
export declare class OasUnion {
    /**
     * Object is part the 'schema' set which is used
     * to define data types in an OpenAPI document.
     */
    oasType: "schema";
    /**
     * Constant value 'union' useful for type narrowing and tagged unions.
     */
    type: "union";
    /**
     * A short summary of the union.
     */
    title: string | undefined;
    /**
     * A description of the union.
     */
    description: string | undefined;
    /**
     * Indicates whether value can be null.
     */
    nullable: boolean | undefined;
    /**
     * Discriminator object used to tag member types and make the union a tagged union.
     */
    discriminator: OasDiscriminator | undefined;
    /**
     * Array of schemas or references to schemas that are part of the union.
     */
    members: (OasSchema | OasRef<'schema'>)[];
    /** Specification Extension fields */
    extensionFields: Record<string, unknown> | undefined;
    /**
     * An example of the union type.
     */
    example?: unknown;
    constructor(fields: UnionFields);
    isRef(): this is OasRef<'schema'>;
    resolve(): OasUnion;
    resolveOnce(): OasUnion;
    toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.SchemaObject;
}
//# sourceMappingURL=Union.d.ts.map