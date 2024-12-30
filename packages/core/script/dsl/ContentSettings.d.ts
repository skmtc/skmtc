import type { Identifier } from './Identifier.js';
type EmptyArgs = {
    exportPath: string;
    identifier: Identifier;
};
type CreateArgs<EnrichmentType> = {
    identifier: Identifier;
    selected: boolean;
    exportPath: string;
    enrichments: EnrichmentType;
};
export declare class ContentSettings<EnrichmentType> {
    identifier: Identifier;
    selected: boolean;
    exportPath: string;
    enrichments: EnrichmentType;
    constructor({ identifier, selected, exportPath, enrichments }: CreateArgs<EnrichmentType>);
    static empty({ identifier, exportPath }: EmptyArgs): ContentSettings<undefined>;
}
export {};
//# sourceMappingURL=ContentSettings.d.ts.map