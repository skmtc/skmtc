import type { ParseContext } from '../../context/ParseContext.js';
import type { OpenAPIV3 } from 'openapi-types';
import type { OasSchema } from './Schema.js';
import type { OasRef } from '../ref/Ref.js';
type ToSchemasV3Args = {
    schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>;
    context: ParseContext;
    childOfComponents?: boolean;
};
export declare const toSchemasV3: ({ schemas, context, childOfComponents }: ToSchemasV3Args) => Record<string, OasSchema | OasRef<"schema">>;
type ToOptionalSchemasV3Args = {
    schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject> | undefined;
    context: ParseContext;
    childOfComponents?: boolean;
};
export declare const toOptionalSchemasV3: ({ schemas, context, childOfComponents }: ToOptionalSchemasV3Args) => Record<string, OasSchema | OasRef<"schema">> | undefined;
type ToSchemaV3Args = {
    schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject;
    context: ParseContext;
};
export declare const toSchemaV3: ({ schema, context }: ToSchemaV3Args) => OasSchema | OasRef<"schema">;
type ToOptionalSchemaV3Args = {
    schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject | undefined;
    context: ParseContext;
};
export declare const toOptionalSchemaV3: ({ schema, context }: ToOptionalSchemaV3Args) => OasSchema | OasRef<"schema"> | undefined;
export {};
//# sourceMappingURL=toSchemasV3.d.ts.map