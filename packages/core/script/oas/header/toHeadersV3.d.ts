import type { ParseContext } from '../../context/ParseContext.js';
import type { OpenAPIV3 } from 'openapi-types';
import { OasHeader } from './Header.js';
import type { OasRef } from '../ref/Ref.js';
type ToHeadersV3Args = {
    headers: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.HeaderObject> | undefined;
    context: ParseContext;
};
export declare const toHeadersV3: ({ headers, context }: ToHeadersV3Args) => Record<string, OasHeader | OasRef<"header">> | undefined;
export {};
//# sourceMappingURL=toHeadersV3.d.ts.map