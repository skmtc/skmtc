export type LicenseFields = {
    name?: string;
    url?: string;
    extensionFields?: Record<string, unknown>;
};
export declare class OasLicense {
    oasType: "license";
    name: string | undefined;
    url: string | undefined;
    extensionFields: Record<string, unknown> | undefined;
    constructor(fields: LicenseFields);
}
//# sourceMappingURL=License.d.ts.map