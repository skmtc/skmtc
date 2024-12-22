export type ContactFields = {
    name?: string;
    url?: string;
    email?: string;
    extensionFields?: Record<string, unknown>;
};
export declare class OasContact {
    oasType: "contact";
    name: string | undefined;
    url: string | undefined;
    email: string | undefined;
    extensionFields: Record<string, unknown> | undefined;
    constructor(fields: ContactFields);
}
//# sourceMappingURL=Contact.d.ts.map