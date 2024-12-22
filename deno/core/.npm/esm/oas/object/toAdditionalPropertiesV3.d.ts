import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import type { OasSchema } from '../schema/Schema.js';
import type { OasRef } from '../ref/Ref.js';
type ToAdditionalPropertiesV3Args = {
    additionalProperties: boolean | OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject | undefined;
    context: ParseContext;
};
export declare const toAdditionalPropertiesV3: ({ additionalProperties, context }: ToAdditionalPropertiesV3Args) => OasSchema | OasRef<"schema"> | boolean | undefined;
export {};
//# sourceMappingURL=toAdditionalPropertiesV3.d.ts.map