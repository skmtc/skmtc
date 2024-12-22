import type { OasRefData } from './ref-types.js';
import type { OasSchema } from '../schema/Schema.js';
import type { OasResponse } from '../response/Response.js';
import type { OasParameter } from '../parameter/Parameter.js';
import type { OasExample } from '../example/Example.js';
import type { OasRequestBody } from '../requestBody/RequestBody.js';
import type { OasHeader } from '../header/Header.js';
import type { OasDocument } from '../document/Document.js';
import type { RefName } from '../../types/RefName.js';
export type RefFields<T extends OasRefData['refType']> = {
    refType: T;
    $ref: string;
    summary?: string;
    description?: string;
};
export declare class OasRef<T extends OasRefData['refType']> {
    #private;
    oasType: 'ref';
    type: 'ref';
    constructor(fields: RefFields<T>, oasDocument: OasDocument);
    isRef(): this is OasRef<T>;
    resolve(lookupsPerformed?: number): ResolvedRef<T>;
    resolveOnce(): OasRef<T> | ResolvedRef<T>;
    toRefName(): RefName;
    get $ref(): string;
    get refType(): OasRefData['refType'];
    get summary(): string | undefined;
    get description(): string | undefined;
    get oasDocument(): OasDocument;
}
export type OasComponentType = OasSchema | OasResponse | OasParameter | OasExample | OasRequestBody | OasHeader;
export type ResolvedRef<T extends OasRefData['refType']> = Extract<OasComponentType, {
    oasType: T;
}>;
//# sourceMappingURL=Ref.d.ts.map