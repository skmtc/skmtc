import { OasUnion } from './Union.js';
import { toDiscriminatorV3 } from '../discriminator/toDiscriminatorV3.js';
import { toSchemaV3 } from '../schema/toSchemasV3.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toUnion = ({ value, members, context }) => {
    const { discriminator, title, description, nullable, example, ...skipped } = value;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    return new OasUnion({
        title,
        description,
        nullable,
        discriminator: context.trace('discriminator', () => toDiscriminatorV3({ discriminator, context })),
        members: members.map((schema, index) => context.trace(`${index}`, () => toSchemaV3({ schema, context }))),
        example,
        extensionFields
    });
};
