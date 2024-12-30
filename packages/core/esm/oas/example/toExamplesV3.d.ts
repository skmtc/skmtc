import type { ParseContext } from '../../context/ParseContext.js';
import type { OpenAPIV3 } from 'openapi-types';
import { OasExample } from './Example.js';
import type { OasRef } from '../ref/Ref.js';
type ToExampleSimpleV3Args = {
    example: unknown;
};
export declare const toExampleSimpleV3: ({ example }: ToExampleSimpleV3Args) => OasExample | OasRef<"example">;
export type ToExamplesV3Args = {
    example: OpenAPIV3.ExampleObject | undefined;
    examples: Record<string, OpenAPIV3.ExampleObject | OpenAPIV3.ReferenceObject> | undefined;
    exampleKey: string;
    context: ParseContext;
};
export declare const toExamplesV3: ({ example, examples, exampleKey, context }: ToExamplesV3Args) => Record<string, OasExample | OasRef<"example">> | undefined;
type ToExampleV3Args = {
    example: OpenAPIV3.ExampleObject | OpenAPIV3.ReferenceObject;
    context: ParseContext;
};
export declare const toExampleV3: ({ example, context }: ToExampleV3Args) => OasExample | OasRef<"example">;
export {};
//# sourceMappingURL=toExamplesV3.d.ts.map