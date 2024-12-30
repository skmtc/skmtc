export type TagFields = {
    name: string;
    description: string | undefined;
    extensionFields?: Record<string, unknown>;
};
export declare class OasTag {
    #private;
    oasType: 'tag';
    constructor(fields: TagFields);
    get name(): string;
    get description(): string | undefined;
    /** Specification Extension fields */
    get extensionFields(): Record<string, unknown> | undefined;
}
//# sourceMappingURL=Tag.d.ts.map