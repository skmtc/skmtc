import type { OasDocument } from '../oas/document/Document.js';
import type { GeneratorType } from '../types/GeneratorType.js';
type ToEnrichmentsArgs<EnrichmentType> = {
    generators: GeneratorType<EnrichmentType>[];
    oasDocument: OasDocument;
};
export type EnrichmentItem = {
    key: string[];
    value: unknown;
};
export declare const toEnrichments: <EnrichmentType>({ generators, oasDocument }: ToEnrichmentsArgs<EnrichmentType>) => Promise<Record<string, EnrichmentItem[]>>;
export {};
//# sourceMappingURL=toEnrichments.d.ts.map