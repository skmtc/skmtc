import type { OpenAPIV3 } from 'openapi-types';
import type { OasDiscriminator } from '../discriminator/Discriminator.js';
import type { OasRef } from '../ref/Ref.js';
import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.js';
export type IntersectionFields = {
    title?: string;
    description?: string;
    nullable?: boolean;
    discriminator?: OasDiscriminator;
    members: (OasSchema | OasRef<'schema'>)[];
    extensionFields?: Record<string, unknown>;
    example?: unknown;
};
export declare class OasIntersection {
    oasType: 'schema';
    type: 'intersection';
    title: string | undefined;
    description: string | undefined;
    nullable: boolean | undefined;
    discriminator: OasDiscriminator | undefined;
    members: (OasSchema | OasRef<'schema'>)[];
    extensionFields: Record<string, unknown> | undefined;
    example: unknown | undefined;
    constructor(fields: IntersectionFields);
    isRef(): this is OasRef<'schema'>;
    resolve(): OasIntersection;
    resolveOnce(): OasIntersection;
    toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.SchemaObject;
}
//# sourceMappingURL=Intersection.d.ts.map