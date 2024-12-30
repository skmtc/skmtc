import type { ClientSettings } from '../types/Settings.js';
import type { PrettierConfigType } from '../types/prettierConfig.js';
import type { ManifestContent } from '../types/Manifest.js';
import type { GeneratorsMap, GeneratorType } from '../types/GeneratorType.js';
type TransformArgs = {
    traceId: string;
    spanId: string;
    schema: string;
    settings: ClientSettings | undefined;
    prettier?: PrettierConfigType;
    logsPath?: string;
    toGeneratorsMap: <EnrichmentType>() => GeneratorsMap<GeneratorType<EnrichmentType>, EnrichmentType>;
    startAt: number;
};
export declare const transform: ({ traceId, spanId, schema, settings, prettier, toGeneratorsMap, logsPath, startAt }: TransformArgs) => {
    artifacts: Record<string, string>;
    manifest: ManifestContent;
};
export {};
//# sourceMappingURL=transform.d.ts.map