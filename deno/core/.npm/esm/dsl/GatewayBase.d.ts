import type { GenerateContext, RegisterArgs } from '../context/GenerateContext.js';
import type { ContentSettings } from './ContentSettings.js';
import { ValueBase } from './ValueBase.js';
export type OperationGatewayArgs = {
    context: GenerateContext;
    settings: ContentSettings;
};
export declare class GatewayBase extends ValueBase {
    settings: ContentSettings;
    constructor({ context, settings }: OperationGatewayArgs);
    register(args: Omit<RegisterArgs, 'destinationPath'>): void;
}
//# sourceMappingURL=GatewayBase.d.ts.map