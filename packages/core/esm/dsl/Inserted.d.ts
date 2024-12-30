import type { GeneratedDefinition, GeneratedValue, GenerationType } from '../types/GeneratedValue.js';
import type { ContentSettings } from './ContentSettings.js';
import type { Identifier } from './Identifier.js';
type ConstructorArgs<V extends GeneratedValue, T extends GenerationType, EnrichmentType> = {
    settings: ContentSettings<EnrichmentType>;
    definition: GeneratedDefinition<V, T>;
};
export declare class Inserted<V extends GeneratedValue, T extends GenerationType, EnrichmentType> {
    settings: ContentSettings<EnrichmentType>;
    definition: GeneratedDefinition<V, T>;
    constructor({ settings, definition }: ConstructorArgs<V, T, EnrichmentType>);
    toName(): string;
    toIdentifier(): Identifier;
    toExportPath(): string;
    toValue(): T extends 'force' ? V : V | undefined;
}
export {};
//# sourceMappingURL=Inserted.d.ts.map