import type { ParseContext } from '../../context/ParseContext.js';
import type { OpenAPIV3 } from 'openapi-types';
import { OasServer } from './Server.js';
type ToServersV3Args = {
    servers: OpenAPIV3.ServerObject[];
    context: ParseContext;
};
export declare const toServersV3: ({ servers, context }: ToServersV3Args) => OasServer[];
type ToOptionalServersV3Args = {
    servers: OpenAPIV3.ServerObject[] | undefined;
    context: ParseContext;
};
export declare const toOptionalServersV3: ({ servers, context }: ToOptionalServersV3Args) => OasServer[] | undefined;
type ToServerV3Args = {
    server: OpenAPIV3.ServerObject;
    context: ParseContext;
};
export declare const toServerV3: ({ server, context }: ToServerV3Args) => OasServer;
export {};
//# sourceMappingURL=toServerV3.d.ts.map