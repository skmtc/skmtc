import { OasIntersection } from './Intersection.js';
import { toDiscriminatorV3 } from '../discriminator/toDiscriminatorV3.js';
import { toSchemaV3 } from '../schema/toSchemasV3.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toIntersection = ({ value, members, context }) => {
    const { discriminator, title, description, nullable, ...skipped } = value;
    const extensionFields = toSpecificationExtensionsV3({ skipped, context });
    return new OasIntersection({
        title,
        description,
        nullable,
        discriminator: context.trace('discriminator', () => toDiscriminatorV3({ discriminator, context })),
        members: members.map((schema, index) => context.trace(`${index}`, () => toSchemaV3({ schema, context }))),
        extensionFields
    });
};
