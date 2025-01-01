import type { OasMediaType } from '../mediaType/MediaType.js';
import type { OasRef } from '../ref/Ref.js';
import type { OasExample } from '../example/Example.js';
import type { OasSchema } from '../schema/Schema.js';
import type { ToJsonSchemaOptions } from '../schema/Schema.js';
import type { OpenAPIV3 } from 'openapi-types';
export type HeaderFields = {
    description: string | undefined;
    required: boolean | undefined;
    deprecated: boolean | undefined;
    schema: OasSchema | OasRef<'schema'> | undefined;
    examples: Record<string, OasExample | OasRef<'example'>> | undefined;
    content: Record<string, OasMediaType> | undefined;
    extensionFields?: Record<string, unknown>;
};
/** Describes a single header in the API */
export declare class OasHeader {
    #private;
    oasType: 'header';
    constructor(fields: HeaderFields);
    /** Brief description of header */
    get description(): string | undefined;
    /** Indicates if header is mandatory. Default value is `false` */
    get required(): boolean | undefined;
    /** Indicates if header is deprecated and should no longer be used. Default value is false */
    get deprecated(): boolean | undefined;
    /** Schema for the header */
    get schema(): OasSchema | OasRef<'schema'> | undefined;
    /** Examples of the header */
    get examples(): Record<string, OasExample | OasRef<'example'>> | undefined;
    /** Content of the header */
    get content(): Record<string, OasMediaType> | undefined;
    /** Specification Extension fields */
    get extensionFields(): Record<string, unknown> | undefined;
    /** Returns true if object is a reference */
    isRef(): this is OasRef<'header'>;
    /** Returns itself */
    resolve(): OasHeader;
    resolveOnce(): OasHeader;
    /** Returns schema for the header. Either, `schema` property if
     * definedor value matching `mediaType` from `content` property.
     *
     * @param mediaType - Optional media type to get schema for. Defaults to `application/json`
     */
    toSchema(mediaType?: string): OasSchema | OasRef<'schema'>;
    toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.HeaderObject;
}
//# sourceMappingURL=Header.d.ts.map