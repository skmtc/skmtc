import type { EnrichmentRequest } from '../types/EnrichmentRequest.js';
export declare const handleEnrichment: <EnrichmentType>({ prompt, content, responseSchema: zodResponseSchema }: EnrichmentRequest<EnrichmentType>) => Promise<string>;
export declare function removeProperties<T extends Record<string, any>>(obj: T, propertyName: string): Partial<T>;
//# sourceMappingURL=handleEnrichment.d.ts.map