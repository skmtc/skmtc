import type { OasDocument } from '../oas/document/Document.js';
import type { ClientSettings, ClientGeneratorSettings } from '../types/Settings.js';
import type { GeneratorType } from '../types/GeneratorType.js';
type ToSettingsArgs<EnrichmentType> = {
    generators: GeneratorType<EnrichmentType>[];
    clientSettings: ClientSettings | undefined;
    defaultSelected: boolean;
    oasDocument: OasDocument;
};
export declare const toSettings: <EnrichmentType>({ generators, clientSettings, defaultSelected, oasDocument }: ToSettingsArgs<EnrichmentType>) => ClientGeneratorSettings[];
export {};
//# sourceMappingURL=toSettings.d.ts.map