import type { GenerateContext } from '../../context/GenerateContext.js';
import type { RefName } from '../../types/RefName.js';
import type { ContentSettings } from '../ContentSettings.js';
import type { Identifier } from '../Identifier.js';
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.js';
import type { z } from 'zod';
export type ModelInsertableArgs<EnrichmentType> = {
    context: GenerateContext;
    settings: ContentSettings<EnrichmentType>;
    refName: RefName;
};
type ToEnrichmentsArgs = {
    refName: RefName;
    context: GenerateContext;
};
export type ModelConfig<EnrichmentType> = {
    id: string;
    toIdentifier: (refName: RefName) => Identifier;
    toExportPath: (refName: RefName) => string;
    toEnrichmentRequest?: (refName: RefName) => EnrichmentRequest<EnrichmentType> | undefined;
    toEnrichmentSchema: () => z.ZodType<EnrichmentType>;
};
export declare const toModelInsertable: <EnrichmentType>(config: ModelConfig<EnrichmentType>) => {
    new (args: ModelInsertableArgs<EnrichmentType>): {
        settings: ContentSettings<EnrichmentType>;
        refName: RefName;
        generatorKey: import("../../types/GeneratorKeys.js").GeneratorKey;
        insertModel<V extends import("../../mod.js").GeneratedValue, ET>(insertable: import("./ModelInsertable.js").ModelInsertable<V, ET>, refName: RefName): import("../Inserted.js").Inserted<V, "force", ET>;
        register(args: import("../../context/GenerateContext.js").BaseRegisterArgs): void;
        context: GenerateContext;
        skipped: boolean;
    };
    id: string;
    type: "model";
    _class: "ModelInsertable";
    toIdentifier: (refName: RefName) => Identifier;
    toExportPath: (refName: RefName) => string;
    toEnrichmentRequest: ((refName: RefName) => EnrichmentRequest<EnrichmentType> | undefined) | undefined;
    toEnrichmentSchema: () => z.ZodType<EnrichmentType>;
    toEnrichments: ({ refName, context }: ToEnrichmentsArgs) => EnrichmentType;
    isSupported: () => boolean;
    pinnable: boolean;
};
export {};
//# sourceMappingURL=toModelInsertable.d.ts.map