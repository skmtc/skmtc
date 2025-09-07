import type { GenerateContext } from '../context/GenerateContext.ts'
import { Definition } from '../dsl/Definition.ts'
import { Identifier } from '../dsl/Identifier.ts'
import type { TypeSystemObject } from '../types/TypeSystem.ts'
import { FunctionParameter } from './FunctionParameter.ts'
import { toPathTemplate } from './toPathTemplate.ts'

/**
 * Constructor arguments for {@link PathParams}.
 */
type ConstructorArgs = {
  /** The generation context for registering types and handling imports */
  context: GenerateContext
  /** Optional argument name for the parameter (if undefined, uses destructuring) */
  argName?: string
  /** Name of the TypeScript type to generate */
  typeName: string
  /** The type system object defining the parameter structure */
  typeValue: TypeSystemObject
  /** OpenAPI path template with parameter placeholders */
  pathTemplate: string
}

/**
 * Manages path parameter type definitions and function parameters for API endpoints.
 * 
 * `PathParams` is a utility class that combines type generation, function parameter
 * handling, and path templating for OpenAPI path parameters. It creates TypeScript
 * type definitions for path parameters and generates the corresponding function
 * parameters that can be used in API client methods.
 * 
 * This class is essential for generating type-safe API clients where path parameters
 * are properly typed and validated at compile time. It handles both destructured
 * parameters (when no argument name is provided) and named parameters.
 * 
 * ## Key Features
 * 
 * - **Type Definition Generation**: Creates TypeScript types for path parameters
 * - **Function Parameter Integration**: Generates properly typed function parameters
 * - **Path Template Processing**: Converts OpenAPI paths to template literals
 * - **Destructuring Support**: Handles both named and destructured parameter patterns
 * - **Context Integration**: Fully integrated with the SKMTC generation pipeline
 * 
 * @example Basic path parameters with destructuring
 * ```typescript
 * import { PathParams } from '@skmtc/core';
 * 
 * const pathParams = new PathParams({
 *   context: generateContext,
 *   typeName: 'GetUserParams',
 *   typeValue: {
 *     type: 'object',
 *     objectProperties: {
 *       properties: {
 *         id: { type: 'string' },
 *         format: { type: 'string' }
 *       }
 *     }
 *   },
 *   pathTemplate: '/users/{id}'
 * });
 * 
 * console.log(pathParams.path); // '/users/${id}'
 * ```
 * 
 * @example Named parameter usage
 * ```typescript
 * const namedPathParams = new PathParams({
 *   context: generateContext,
 *   argName: 'params',
 *   typeName: 'UserPathParams',
 *   typeValue: {
 *     type: 'object',
 *     objectProperties: {
 *       properties: {
 *         userId: { type: 'string' },
 *         projectId: { type: 'string' }
 *       }
 *     }
 *   },
 *   pathTemplate: '/users/{userId}/projects/{projectId}'
 * });
 * 
 * console.log(pathParams.path); // '/users/${params.userId}/projects/${params.projectId}'
 * ```
 * 
 * @example API client method generation
 * ```typescript
 * class ApiMethodGenerator {
 *   generateGetMethod(operationPath: string, parameters: any) {
 *     const pathParams = new PathParams({
 *       context: this.context,
 *       argName: 'pathParams',
 *       typeName: 'PathParameters',
 *       typeValue: parameters,
 *       pathTemplate: operationPath
 *     });
 *     
 *     return `
 * async getData(${pathParams.parameter.toString()}) {
 *   const url = \`${pathParams.path}\`;
 *   return this.client.get(url);
 * }`;
 *   }
 * }
 * 
 * // Generates:
 * // async getData(pathParams: PathParameters) {
 * //   const url = `/users/${pathParams.userId}/projects/${pathParams.projectId}`;
 * //   return this.client.get(url);
 * // }
 * ```
 * 
 * @example With destructured parameters
 * ```typescript
 * const destructuredParams = new PathParams({
 *   context: generateContext,
 *   // No argName provided, so uses destructuring
 *   typeName: 'OrderParams',
 *   typeValue: {
 *     type: 'object',
 *     objectProperties: {
 *       properties: {
 *         orderId: { type: 'string' },
 *         customerId: { type: 'string' }
 *       }
 *     }
 *   },
 *   pathTemplate: '/customers/{customerId}/orders/{orderId}'
 * });
 * 
 * // Function parameter will be: { orderId, customerId }: OrderParams
 * // Path template will be: '/customers/${customerId}/orders/${orderId}'
 * ```
 * 
 * @example Complex nested path parameters
 * ```typescript
 * const complexPathParams = new PathParams({
 *   context: generateContext,
 *   argName: 'pathData',
 *   typeName: 'ComplexPathParams',
 *   typeValue: {
 *     type: 'object',
 *     objectProperties: {
 *       properties: {
 *         orgId: { type: 'string' },
 *         projectId: { type: 'string' },
 *         issueId: { type: 'number' },
 *         commentId: { type: 'string' }
 *       }
 *     }
 *   },
 *   pathTemplate: '/orgs/{orgId}/projects/{projectId}/issues/{issueId}/comments/{commentId}'
 * });
 * 
 * // Generates path: '/orgs/${pathData.orgId}/projects/${pathData.projectId}/issues/${pathData.issueId}/comments/${pathData.commentId}'
 * ```
 * 
 * @example Integration with operation generation
 * ```typescript
 * class OperationGenerator {
 *   generateOperation(operation: OasOperation) {
 *     const pathParameters = this.extractPathParameters(operation);
 *     
 *     if (pathParameters.length > 0) {
 *       const pathParams = new PathParams({
 *         context: this.context,
 *         typeName: `${operation.operationId}PathParams`,
 *         typeValue: this.buildParametersType(pathParameters),
 *         pathTemplate: operation.path
 *       });
 *       
 *       return this.generateMethodWithPathParams(operation, pathParams);
 *     }
 *     
 *     return this.generateSimpleMethod(operation);
 *   }
 * }
 * ```
 */
export class PathParams {
  /** The generation context used for type registration and imports */
  context: GenerateContext
  
  /** The TypeScript type definition for the path parameters */
  typeDefinition: Definition<TypeSystemObject>
  
  /** The function parameter representation for method signatures */
  parameter: FunctionParameter
  
  /** The processed path template with parameter substitutions */
  path: string

  /**
   * Creates a new PathParams instance with type definitions and path processing.
   * 
   * The constructor sets up the complete parameter handling pipeline:
   * 1. Creates a TypeScript type definition for the parameters
   * 2. Generates a function parameter (either named or destructured)
   * 3. Processes the path template for runtime interpolation
   * 
   * @param args - Configuration for path parameter generation
   * 
   * @example
   * ```typescript
   * const pathParams = new PathParams({
   *   context: generateContext,
   *   argName: 'params',
   *   typeName: 'UserPathParams',
   *   typeValue: {
   *     type: 'object',
   *     objectProperties: {
   *       properties: {
   *         id: { type: 'string' },
   *         format: { type: 'string' }
   *       }
   *     }
   *   },
   *   pathTemplate: '/users/{id}/profile'
   * });
   * ```
   */
  constructor({
    context,
    argName,
    typeName,
    typeValue,
    pathTemplate
  }: ConstructorArgs) {
    this.context = context

    this.typeDefinition = new Definition<TypeSystemObject>({
      context,
      identifier: Identifier.createType(typeName),
      value: typeValue
    })

    this.parameter = new FunctionParameter({
      name: argName,
      typeDefinition: this.typeDefinition,
      destructure: !argName,
      required: true
    })

    const queryArg =
      this.parameter.properties.type === 'regular'
        ? this.parameter.properties.name
        : undefined

    // @TODO Reconcile pathTemplate with params
    this.path = toPathTemplate(pathTemplate, queryArg)
  }
}
