import type { GenerateContext } from '../../context/GenerateContext.js';
import type { RefName } from '../../types/RefName.js';
import type { ContentSettings } from '../ContentSettings.js';
import type { Identifier } from '../Identifier.js';
export type ModelInsertableArgs = {
    context: GenerateContext;
    settings: ContentSettings;
    refName: RefName;
};
export type ModelConfig = {
    id: string;
    toIdentifier: (refName: RefName) => Identifier;
    toExportPath: (refName: RefName) => string;
};
export declare const toModelInsertable: (config: ModelConfig) => {
    new (args: ModelInsertableArgs): {
        settings: ContentSettings;
        refName: RefName;
        generatorKey: import("../../types/GeneratorKeys.js").GeneratorKey;
        insertModel<V extends import("../../mod.js").GeneratedValue>(insertable: import("./ModelInsertable.js").ModelInsertable<V>, refName: RefName): import("../Inserted.js").Inserted<V, "force">;
        register(args: Omit<import("../../context/GenerateContext.js").RegisterArgs, "destinationPath">): void;
        context: GenerateContext;
        skipped: boolean;
    };
    id: string;
    type: "model";
    _class: "ModelInsertable";
    toIdentifier: (refName: RefName) => Identifier;
    toExportPath: (refName: RefName) => string;
    isSupported: () => boolean;
    pinnable: boolean;
};
//# sourceMappingURL=toModelInsertable.d.ts.map