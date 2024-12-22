import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasDiscriminator } from './Discriminator.js';
type ToDiscriminatorV3Args = {
    discriminator: OpenAPIV3.DiscriminatorObject | undefined;
    context: ParseContext;
};
export declare const toDiscriminatorV3: ({ discriminator, context }: ToDiscriminatorV3Args) => OasDiscriminator | undefined;
export {};
//# sourceMappingURL=toDiscriminatorV3.d.ts.map