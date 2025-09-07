import { ContentBase } from '../dsl/ContentBase.ts'
import type { GenerateContext } from '../context/GenerateContext.ts'
import type { OasOperation } from '../oas/operation/Operation.ts'
import type { GeneratorKey } from '../types/GeneratorKeys.ts'

/**
 * Constructor arguments for {@link ReactRouterPathParams}.
 */
type CreateArgs = {
  /** The generation context for registering imports and handling dependencies */
  context: GenerateContext
  /** The generator key identifying this component */
  generatorKey: GeneratorKey
  /** The OpenAPI operation containing path parameters */
  operation: OasOperation
  /** The destination file path for import registration */
  destinationPath: string
}

/**
 * Generates React Router path parameter handling code for OpenAPI operations.
 * 
 * `ReactRouterPathParams` is a specialized content generator that creates the necessary
 * React code for extracting and validating path parameters from React Router's `useParams`
 * hook. It automatically generates parameter extraction, assertion logic, and prop passing
 * code based on OpenAPI operation path parameters.
 * 
 * This class is essential for generating type-safe React components that need to access
 * URL path parameters, ensuring runtime validation and proper TypeScript typing. It
 * integrates with React Router's `useParams` hook and adds runtime assertions using
 * the `tiny-invariant` library.
 * 
 * ## Key Features
 * 
 * - **Automatic Parameter Extraction**: Generates `useParams()` destructuring code
 * - **Runtime Assertions**: Creates invariant checks for required parameters
 * - **Prop Passing**: Generates prop spreading syntax for component integration
 * - **Import Management**: Automatically registers required imports
 * - **Type Safety**: Ensures parameters are properly validated at runtime
 * 
 * @example Basic usage with single path parameter
 * ```typescript
 * import { ReactRouterPathParams } from '@skmtc/core';
 * 
 * const operation = new OasOperation({
 *   path: '/users/{id}',
 *   method: 'get',
 *   // ... other operation properties
 * });
 * 
 * const pathParams = new ReactRouterPathParams({
 *   context: generateContext,
 *   generatorKey: 'react-router-params',
 *   operation,
 *   destinationPath: './UserDetail.tsx'
 * });
 * 
 * console.log(pathParams.getParams);
 * // 'const { id } = useParams()'
 * 
 * console.log(pathParams.assertParams);
 * // 'invariant(id, 'Expected id to be defined')'
 * 
 * console.log(pathParams.passProps);
 * // 'id={id}'
 * ```
 * 
 * @example Multiple path parameters
 * ```typescript
 * const complexOperation = new OasOperation({
 *   path: '/organizations/{orgId}/projects/{projectId}/issues/{issueId}',
 *   method: 'get',
 *   // ... other properties
 * });
 * 
 * const multiParams = new ReactRouterPathParams({
 *   context: generateContext,
 *   generatorKey: 'react-router-params',
 *   operation: complexOperation,
 *   destinationPath: './IssueDetail.tsx'
 * });
 * 
 * console.log(multiParams.getParams);
 * // 'const { orgId, projectId, issueId } = useParams()'
 * 
 * console.log(multiParams.assertParams);
 * // 'invariant(orgId, 'Expected orgId to be defined')
 * // invariant(projectId, 'Expected projectId to be defined')  
 * // invariant(issueId, 'Expected issueId to be defined')'
 * 
 * console.log(multiParams.passProps);
 * // 'orgId={orgId} projectId={projectId} issueId={issueId}'
 * ```
 * 
 * @example Generated React component integration
 * ```typescript
 * // Generated component might look like:
 * import { useParams } from 'react-router-dom';
 * import invariant from 'tiny-invariant';
 * 
 * function UserDetail() {
 *   const { id } = useParams();
 *   invariant(id, 'Expected id to be defined');
 *   
 *   return <UserDetailView id={id} />;
 * }
 * ```
 * 
 * @example No path parameters (empty generation)
 * ```typescript
 * const simpleOperation = new OasOperation({
 *   path: '/users',
 *   method: 'get',
 *   // ... other properties
 * });
 * 
 * const emptyParams = new ReactRouterPathParams({
 *   context: generateContext,
 *   generatorKey: 'react-router-params',
 *   operation: simpleOperation,
 *   destinationPath: './UserList.tsx'
 * });
 * 
 * console.log(emptyParams.getParams);    // ''
 * console.log(emptyParams.assertParams); // ''
 * console.log(emptyParams.passProps);    // ''
 * // No imports registered for this case
 * ```
 * 
 * @example Integration in component generation
 * ```typescript
 * class ReactComponentGenerator {
 *   generateDetailComponent(operation: OasOperation) {
 *     const pathParams = new ReactRouterPathParams({
 *       context: this.context,
 *       generatorKey: 'react-component',
 *       operation,
 *       destinationPath: this.getDestinationPath(operation)
 *     });
 *     
 *     if (pathParams.names.length === 0) {
 *       // Generate simple component without parameters
 *       return this.generateSimpleComponent(operation);
 *     }
 *     
 *     return `
 * function ${operation.operationId}() {
 *   ${pathParams.getParams}
 *   ${pathParams.assertParams}
 *   
 *   return (
 *     <DetailView ${pathParams.passProps} />
 *   );
 * }`;
 *   }
 * }
 * ```
 * 
 * @example Custom parameter validation
 * ```typescript
 * class CustomReactRouterParams extends ReactRouterPathParams {
 *   generateCustomAssertions(paramName: string): string {
 *     return `
 * invariant(${paramName}, 'Expected ${paramName} to be defined');
 * invariant(typeof ${paramName} === 'string', '${paramName} must be a string');
 * invariant(${paramName}.length > 0, '${paramName} cannot be empty');`;
 *   }
 * }
 * ```
 */
export class ReactRouterPathParams extends ContentBase {
  /** Generated code for extracting parameters from useParams() */
  getParams: string = ''

  /** Generated code for runtime parameter assertions */
  assertParams: string = ''

  /** Generated code for passing parameters as component props */
  passProps: string = ''

  /** Array of parameter names extracted from the operation path */
  names: string[]

  /**
   * Creates a new ReactRouterPathParams instance with generated parameter handling code.
   * 
   * The constructor analyzes the OpenAPI operation to extract path parameters and
   * generates the necessary React code for parameter extraction, validation, and
   * prop passing. It automatically registers required imports when parameters are present.
   * 
   * @param args - Configuration for React Router parameter generation
   * 
   * @example
   * ```typescript
   * const pathParams = new ReactRouterPathParams({
   *   context: generateContext,
   *   generatorKey: 'react-params',
   *   operation: userDetailOperation, // has path '/users/{id}'
   *   destinationPath: './UserDetail.tsx'
   * });
   * ```
   */
  constructor({ context, operation, generatorKey, destinationPath }: CreateArgs) {
    super({ context, generatorKey })

    const names = operation.toParams(['path']).map(param => param.name)

    this.names = names

    if (names.length > 0) {
      this.getParams = `const { ${names.join(', ')} } = useParams()`
      this.assertParams = names
        .map(param => `invariant(${param}, 'Expected ${param} to be defined')`)
        .join('\n')
      this.passProps = names.map(param => `${param}={${param}}`).join(' ')

      this.register({
        imports: {
          'react-router-dom': ['useParams'],
          'tiny-invariant': [{ default: 'invariant' }]
        },
        destinationPath
      })
    }
  }

  /**
   * Returns an empty string as this class provides code through its properties.
   * 
   * The ReactRouterPathParams class doesn't generate output through toString(),
   * instead providing generated code through the `getParams`, `assertParams`,
   * and `passProps` properties which can be used directly in template generation.
   * 
   * @returns Empty string
   */
  override toString(): string {
    return ``
  }
}
