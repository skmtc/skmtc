import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasInfo } from './Info.js';
type ToInfoV3Args = {
    info: OpenAPIV3.InfoObject;
    context: ParseContext;
};
export declare const toInfoV3: ({ info, context }: ToInfoV3Args) => OasInfo;
export {};
//# sourceMappingURL=toInfoV3.d.ts.map