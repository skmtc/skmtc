import type { OasContact } from '../contact/Contact.js';
import type { OasLicense } from '../license/License.js';
export type InfoFields = {
    title: string;
    version: string;
    description?: string | undefined;
    termsOfService?: string | undefined;
    contact?: OasContact | undefined;
    license?: OasLicense | undefined;
    extensionFields?: Record<string, unknown>;
};
export declare class OasInfo {
    #private;
    oasType: 'info';
    constructor(fields: InfoFields);
    get title(): string;
    get description(): string | undefined;
    get termsOfService(): string | undefined;
    get contact(): OasContact | undefined;
    get license(): OasLicense | undefined;
    get version(): string;
    /** Specification Extension fields */
    get extensionFields(): Record<string, unknown> | undefined;
}
//# sourceMappingURL=Info.d.ts.map