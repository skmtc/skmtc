import type { OpenAPIV3_1 } from 'openapi-types';
import type { OasRefData } from './ref-types.js';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasRef } from './Ref.js';
type ToRefV31Args<T extends OasRefData['refType']> = {
    ref: OpenAPIV3_1.ReferenceObject;
    refType: T;
    context: ParseContext;
};
export declare const toRefV31: <T extends OasRefData["refType"]>({ ref, refType, context }: ToRefV31Args<T>) => OasRef<T>;
export {};
//# sourceMappingURL=toRefV31.d.ts.map