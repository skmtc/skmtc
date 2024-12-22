import type { OasResponse } from '../response/Response.js';
import type { OasParameter } from '../parameter/Parameter.js';
import type { OasExample } from '../example/Example.js';
import type { OasRequestBody } from '../requestBody/RequestBody.js';
import type { OasHeader } from '../header/Header.js';
import type { OasRef } from '../ref/Ref.js';
import type { OasSchema } from '../schema/Schema.js';
import type { RefName } from '../../types/RefName.js';
export type ComponentsFields = {
    schemas?: Record<RefName, OasSchema | OasRef<'schema'>>;
    responses?: Record<RefName, OasResponse | OasRef<'response'>>;
    parameters?: Record<RefName, OasParameter | OasRef<'parameter'>>;
    examples?: Record<RefName, OasExample | OasRef<'example'>>;
    requestBodies?: Record<RefName, OasRequestBody | OasRef<'requestBody'>>;
    headers?: Record<RefName, OasHeader | OasRef<'header'>>;
    extensionFields?: Record<string, unknown>;
};
/** Container object for re-usable schema items within the API
 *
 * Fields not yet implemented: **securitySchemes**, **links**, **callbacks**
 */
export declare class OasComponents {
    #private;
    /** Static identifier property for OasComponents */
    oasType: "components";
    constructor(fields: ComponentsFields);
    toSchemasRefNames(): RefName[];
    /** Record holding re-usable {@link OasSchema} objects or Refs  */
    get schemas(): Record<RefName, OasSchema | OasRef<'schema'>> | undefined;
    /** Record holding re-usable {@link OasResponse} objects or Refs  */
    get responses(): Record<RefName, OasResponse | OasRef<'response'>> | undefined;
    /** Record holding re-usable {@link OasParameter} objects or Refs  */
    get parameters(): Record<RefName, OasParameter | OasRef<'parameter'>> | undefined;
    /** Record holding re-usable {@link OasExample} objects or Refs  */
    get examples(): Record<RefName, OasExample | OasRef<'example'>> | undefined;
    /** Record holding re-usable {@link OasRequestBody} objects or Refs  */
    get requestBodies(): Record<RefName, OasRequestBody | OasRef<'requestBody'>> | undefined;
    /** Record holding re-usable {@link OasHeader} objects or Refs  */
    get headers(): Record<RefName, OasHeader | OasRef<'header'>> | undefined;
    /** Specification Extension fields */
    get extensionFields(): Record<string, unknown> | undefined;
}
//# sourceMappingURL=Components.d.ts.map