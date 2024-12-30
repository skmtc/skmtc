import type { ClientGeneratorSettings } from '../types/Settings.js';
import type { EnrichmentItem } from './toEnrichments.js';
type EnrichSettingsArgs = {
    generatorSettings: ClientGeneratorSettings[];
    enrichments: Record<string, EnrichmentItem[]>;
};
export declare const enrichSettings: ({ generatorSettings, enrichments }: EnrichSettingsArgs) => ClientGeneratorSettings[];
export {};
//# sourceMappingURL=enrichSettings.d.ts.map