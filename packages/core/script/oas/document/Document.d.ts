import type { OasTag } from '../tag/Tag.js';
import type { OasComponents } from '../components/Components.js';
import type { OasOperation } from '../operation/Operation.js';
import type { OasInfo } from '../info/Info.js';
export type DocumentFields = {
    openapi: string;
    info: OasInfo;
    operations: OasOperation[];
    components?: OasComponents | undefined;
    tags?: OasTag[] | undefined;
    extensionFields?: Record<string, unknown>;
};
/** Top level document object describing the API */
export declare class OasDocument {
    #private;
    /** Static identifier property for OasDocument */
    oasType: 'openapi';
    constructor(fields?: DocumentFields);
    set fields(fields: DocumentFields);
    /** OpenAPI specification version */
    get openapi(): string;
    /** API metadata */
    get info(): OasInfo;
    /** List of all operations for the API */
    get operations(): OasOperation[];
    /** Container object for re-usable schema items within the API */
    get components(): OasComponents | undefined;
    /** List of tags used by API with additional metadata */
    get tags(): OasTag[] | undefined;
    /** Specification Extension fields */
    get extensionFields(): Record<string, unknown> | undefined;
}
//# sourceMappingURL=Document.d.ts.map