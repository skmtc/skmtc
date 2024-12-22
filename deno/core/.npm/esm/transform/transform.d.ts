import type { ClientSettings } from '../types/Settings.js';
import type { PrettierConfigType } from '../types/prettierConfig.js';
import type { OperationGateway, OperationInsertable } from '../dsl/operation/OperationInsertable.js';
import type { ModelInsertable } from '../dsl/model/ModelInsertable.js';
import type { ManifestContent } from '../types/Manifest.js';
import type { GeneratedValue } from '../types/GeneratedValue.js';
type TransformArgs = {
    traceId: string;
    spanId: string;
    schema: string;
    settings?: ClientSettings;
    prettier?: PrettierConfigType;
    logsPath?: string;
    generatorsMap: Record<string, OperationGateway | OperationInsertable<GeneratedValue> | ModelInsertable<GeneratedValue>>;
    startAt: number;
};
export declare const transform: ({ traceId, spanId, schema, settings, prettier, generatorsMap, logsPath, startAt }: TransformArgs) => {
    artifacts: Record<string, string>;
    manifest: ManifestContent;
};
export {};
//# sourceMappingURL=transform.d.ts.map