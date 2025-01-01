import type { ToJsonSchemaOptions } from '../schema/Schema.js';
import type { OpenAPIV3 } from 'openapi-types';
export type ServerFields = {
    description?: string | undefined;
    url: string;
    extensionFields?: Record<string, unknown>;
};
export declare class OasServer {
    oasType: 'server';
    description: string | undefined;
    url: string;
    extensionFields: Record<string, unknown> | undefined;
    constructor(fields: ServerFields);
    isRef(): boolean;
    resolve(): OasServer;
    resolveOnce(): OasServer;
    toJsonSchema(_options: ToJsonSchemaOptions): OpenAPIV3.ServerObject;
}
//# sourceMappingURL=Server.d.ts.map