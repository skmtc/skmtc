import type { OasRef } from '../ref/Ref.js';
import type { ToJsonSchemaOptions } from '../schema/Schema.js';
import type { OpenAPIV3 } from 'openapi-types';
export type ExampleFields = {
    summary: string | undefined;
    description: string | undefined;
    value: unknown;
    extensionFields?: Record<string, unknown>;
};
/** Provides example data represented by schema */
export declare class OasExample {
    #private;
    /** Static identifier property for OasExample */
    oasType: 'example';
    constructor(fields: ExampleFields);
    /** Brief summary of example */
    get summary(): string | undefined;
    /** Detailed description of the example. May contain CommonMark Markdown */
    get description(): string | undefined;
    /** Embedded example value */
    get value(): unknown;
    /** Specification Extension fields */
    get extensionFields(): Record<string, unknown> | undefined;
    /** Returns true if object is a reference */
    isRef(): this is OasRef<'example'>;
    /** Returns itself */
    resolve(): OasExample;
    resolveOnce(): OasExample;
    toJsonSchema(_options: ToJsonSchemaOptions): OpenAPIV3.ExampleObject;
}
//# sourceMappingURL=Example.d.ts.map