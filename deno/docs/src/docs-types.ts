// TypeScript types for the SKMTC docs.json structure
// Generated from analysis of skmtc/deno/core/docs/docs.json

export type DocsJson = {
  version: number;
  nodes: DocNode[];
};

// Base properties shared by all DocNode types
export type DocNodeBase = {
  name: string;
  isDefault?: boolean;
  location: Location;
  declarationKind: DeclarationKind;
  jsDoc?: JsDoc;
};

// Discriminated union for DocNode
export type DocNode = 
  | ModuleDocNode
  | VariableNode
  | TypeAliasNode
  | FunctionNode
  | ClassNode
  | InterfaceNode
  | NamespaceNode
  | EnumNode
  | ImportNode
  | ExportNode;

export type ModuleDocNode = DocNodeBase & {
  kind: "moduleDoc";
};

export type VariableNode = DocNodeBase & {
  kind: "variable";
  variableDef: VariableDef;
};

export type TypeAliasNode = DocNodeBase & {
  kind: "typeAlias";
  typeAliasDef: TypeAliasDef;
};

export type FunctionNode = DocNodeBase & {
  kind: "function";
  functionDef: FunctionDef;
};

export type ClassNode = DocNodeBase & {
  kind: "class";
  classDef: ClassDef;
};

export type InterfaceNode = DocNodeBase & {
  kind: "interface";
  interfaceDef: InterfaceDef;
};

export type NamespaceNode = DocNodeBase & {
  kind: "namespace";
  namespaceDef: NamespaceDef;
};

export type EnumNode = DocNodeBase & {
  kind: "enum";
  enumDef: EnumDef;
};

export type ImportNode = DocNodeBase & {
  kind: "import";
};

export type ExportNode = DocNodeBase & {
  kind: "export";
};

export type Location = {
  filename: string;
  line: number;
  col: number;
  byteIndex: number;
};

export type DeclarationKind = 
  | "export" 
  | "declare" 
  | "private" 
  | "protected";

export type JsDoc = {
  doc?: string;
  tags?: JsDocTag[];
};

export type JsDocTag = {
  kind: JsDocTagKind;
  name?: string;
  doc?: string;
};

export type JsDocTagKind = 
  | "module"
  | "example" 
  | "param"
  | "return"
  | "returns"
  | "throws"
  | "deprecated"
  | "since"
  | "see"
  | "author"
  | "version"
  | "experimental"
  | "internal"
  | "template"
  | "unsupported";

// NodeKind is now inferred from the discriminated union
export type NodeKind = DocNode["kind"];

export type VariableDef = {
  tsType: TsType;
  kind: VariableKind;
};

export type VariableKind = "const" | "let" | "var";

export type TypeAliasDef = {
  tsType: TsType;
  typeParams: TypeParam[];
};

export type FunctionDef = {
  params: Param[];
  returnType?: TsType;
  hasBody: boolean;
  isAsync: boolean;
  isGenerator: boolean;
  typeParams: TypeParam[];
};

export type ClassDef = {
  isAbstract: boolean;
  constructors: ClassConstructor[];
  properties: ClassProperty[];
  methods: ClassMethod[];
  indexSignatures: ClassIndexSignature[];
  superClass?: TsType;
  implements: TsType[];
  typeParams: TypeParam[];
  decorators?: Decorator[];
};

export type InterfaceDef = {
  extends: TsType[];
  methods: InterfaceMethod[];
  properties: InterfaceProperty[];
  callSignatures: InterfaceCallSignature[];
  indexSignatures: InterfaceIndexSignature[];
  typeParams: TypeParam[];
};

export type NamespaceDef = {
  elements: DocNode[];
};

export type EnumDef = {
  members: EnumMember[];
};

export type EnumMember = {
  name: string;
  jsDoc?: JsDoc;
  location: Location;
  init?: TsType;
};

// Base properties shared by all TsType types
export type TsTypeBase = {
  repr: string;
};

// Discriminated union for TsType
export type TsType = 
  | TsTypeKeyword
  | TsTypeLiteralType
  | TsTypeObjectLiteralType
  | TsTypeArray
  | TsTypeTuple
  | TsTypeReference
  | TsTypeUnion
  | TsTypeIntersection
  | TsTypeConditionalType
  | TsTypeInferType
  | TsTypeIndexedType
  | TsTypeMappedType
  | TsTypeFnOrConstructorType
  | TsTypeParenthesized
  | TsTypeRest
  | TsTypeOptional
  | TsTypeIdentifier
  | TsTypeIndexedAccess
  | TsTypeOperator
  | TsTypePredicate
  | TsTypeQuery;

export type TsTypeKeyword = TsTypeBase & {
  kind: "keyword";
  keyword: string;
};

export type TsTypeLiteralType = TsTypeBase & {
  kind: "literal";
  literal: TsTypeLiteral;
};

export type TsTypeObjectLiteralType = TsTypeBase & {
  kind: "typeLiteral";
  typeLiteral: TsTypeObjectLiteral;
};

export type TsTypeArray = TsTypeBase & {
  kind: "array";
  array: TsType;
};

export type TsTypeTuple = TsTypeBase & {
  kind: "tuple";
  tuple: TsType[];
};

export type TsTypeReference = TsTypeBase & {
  kind: "typeRef";
  typeRef: TsTypeRef;
};

export type TsTypeUnion = TsTypeBase & {
  kind: "union";
  union: TsType[];
};

export type TsTypeIntersection = TsTypeBase & {
  kind: "intersection";
  intersection: TsType[];
};

export type TsTypeConditionalType = TsTypeBase & {
  kind: "conditional";
  conditionalType?: TsTypeConditional;
};

export type TsTypeInferType = TsTypeBase & {
  kind: "infer";
  infer: TsTypeInfer;
};

export type TsTypeIndexedType = TsTypeBase & {
  kind: "indexed";
  indexed: TsTypeIndexed;
};

export type TsTypeMappedType = TsTypeBase & {
  kind: "mapped";
  mapped?: TsTypeMapped;
};

export type TsTypeFnOrConstructorType = TsTypeBase & {
  kind: "fnOrConstructor";
  fnOrConstructor: TsTypeFnOrConstructor;
};

export type TsTypeParenthesized = TsTypeBase & {
  kind: "parenthesized";
  parenthesized: TsType;
};

export type TsTypeRest = TsTypeBase & {
  kind: "rest";
  rest: TsType;
};

export type TsTypeOptional = TsTypeBase & {
  kind: "optional";
  optional: TsType;
};

export type TsTypeIdentifier = TsTypeBase & {
  kind: "identifier";
};

export type TsTypeIndexedAccess = TsTypeBase & {
  kind: "indexedAccess";
  indexedAccess: TsTypeIndexed;
};

export type TsTypeOperator = TsTypeBase & {
  kind: "typeOperator";
  typeOperator: unknown;
};

export type TsTypePredicate = TsTypeBase & {
  kind: "typePredicate";
  typePredicate: unknown;
};

export type TsTypeQuery = TsTypeBase & {
  kind: "typeQuery";
  typeQuery: unknown;
};

export type TsTypeKind = 
  | "keyword"
  | "literal" 
  | "typeLiteral"
  | "array"
  | "tuple"
  | "typeRef"
  | "union"
  | "intersection"
  | "conditional"
  | "infer"
  | "indexed"
  | "mapped"
  | "fnOrConstructor"
  | "parenthesized"
  | "rest"
  | "optional"
  | "identifier";

// Discriminated union for TsTypeLiteral
export type TsTypeLiteral = 
  | TsTypeLiteralString
  | TsTypeLiteralNumber
  | TsTypeLiteralBoolean
  | TsTypeLiteralBigInt
  | TsTypeLiteralTemplate;

export type TsTypeLiteralString = {
  kind: "string";
  string: string;
};

export type TsTypeLiteralNumber = {
  kind: "number";
  number: number;
};

export type TsTypeLiteralBoolean = {
  kind: "boolean";
  boolean: boolean;
};

export type TsTypeLiteralBigInt = {
  kind: "bigInt";
  bigInt: string;
};

export type TsTypeLiteralTemplate = {
  kind: "template";
  template: unknown;
};

export type LiteralKind = "string" | "number" | "boolean" | "bigInt";

export type TsTypeObjectLiteral = {
  constructors: TsTypeConstructor[];
  methods: TsTypeMethod[];
  properties: TsTypeProperty[];
  callSignatures: TsTypeCallSignature[];
  indexSignatures: TsTypeIndexSignature[];
};

export type TsTypeRef = {
  typeName: string;
  typeParams?: TsType[] | null;
};

export type TsTypeConditional = {
  checkType: TsType;
  extendsType: TsType;
  trueType: TsType;
  falseType: TsType;
};

export type TsTypeInfer = {
  typeParam: TypeParam;
};

export type TsTypeIndexed = {
  readonly: boolean;
  objType: TsType;
  indexType: TsType;
};

export type TsTypeMapped = {
  readonly?: boolean;
  optional?: boolean;
  typeParam: TypeParam;
  nameType?: TsType;
  tsType?: TsType;
};

export type TsTypeFnOrConstructor = {
  constructor: boolean;
  tsType: TsType;
  params: Param[];
  typeParams: TypeParam[];
};

export type TsTypeConstructor = {
  jsDoc?: JsDoc;
  accessibility?: Accessibility | null;
  name?: string;
  params: Param[];
  location: Location;
};

export type TsTypeMethod = {
  jsDoc?: JsDoc;
  accessibility?: Accessibility | null;
  optional: boolean;
  name: string;
  kind: MethodKind;
  functionDef: FunctionDef;
  location: Location;
};

export type TsTypeProperty = {
  jsDoc?: JsDoc;
  accessibility?: Accessibility | null;
  name: string;
  params: Param[];
  computed: boolean;
  optional: boolean;
  tsType: TsType;
  typeParams: TypeParam[];
  location: Location;
};

export type TsTypeCallSignature = {
  jsDoc?: JsDoc;
  params: Param[];
  tsType: TsType;
  typeParams: TypeParam[];
};

export type TsTypeIndexSignature = {
  readonly: boolean;
  params: Param[];
  tsType?: TsType;
};

export type ClassConstructor = {
  jsDoc?: JsDoc;
  accessibility?: Accessibility | null;
  name: string;
  params: Param[];
  location: Location;
};

export type ClassProperty = {
  jsDoc?: JsDoc;
  tsType?: TsType;
  readonly: boolean;
  accessibility?: Accessibility | null;
  optional: boolean;
  isAbstract: boolean;
  isStatic: boolean;
  name: string;
  location: Location;
  decorators?: Decorator[];
};

export type ClassMethod = {
  jsDoc?: JsDoc;
  accessibility?: Accessibility | null;
  optional: boolean;
  isAbstract: boolean;
  isStatic: boolean;
  name: string;
  kind: MethodKind;
  functionDef: FunctionDef;
  location: Location;
  decorators?: Decorator[];
};

export type ClassIndexSignature = {
  readonly: boolean;
  params: Param[];
  tsType?: TsType;
};

export type InterfaceMethod = {
  name: string;
  location: Location;
  jsDoc?: JsDoc;
  optional: boolean;
  params: Param[];
  returnType?: TsType;
  typeParams: TypeParam[];
};

export type InterfaceProperty = {
  name: string;
  location: Location;
  jsDoc?: JsDoc;
  params: Param[];
  computed: boolean;
  optional: boolean;
  tsType: TsType;
  typeParams: TypeParam[];
};

export type InterfaceCallSignature = {
  jsDoc?: JsDoc;
  location: Location;
  params: Param[];
  tsType: TsType;
  typeParams: TypeParam[];
};

export type InterfaceIndexSignature = {
  readonly: boolean;
  params: Param[];
  tsType?: TsType;
};

// Discriminated union for Param
export type Param = 
  | ParamIdentifier
  | ParamArray
  | ParamObject
  | ParamRest
  | ParamAssign
  | ParamKeyValue;

export type ParamIdentifier = {
  kind: "identifier";
  name?: string;
  optional?: boolean;
  tsType?: TsType | null;
};

export type ParamArray = {
  kind: "array";
  elements?: Param[];
  optional?: boolean;
  tsType?: TsType | null;
};

export type ParamObject = {
  kind: "object";
  props?: Param[];
  optional?: boolean;
  tsType?: TsType | null;
};

export type ParamRest = {
  kind: "rest";
  arg?: Param;
  optional?: boolean;
  tsType?: TsType | null;
};

export type ParamAssign = {
  kind: "assign";
  left?: Param;
  right?: unknown;
  optional?: boolean;
  tsType?: TsType | null;
};

export type ParamKeyValue = {
  kind: "keyValue";
  key?: string;
  value?: Param;
  optional?: boolean;
  tsType?: TsType | null;
};

export type ParamKind = "identifier" | "array" | "object" | "rest" | "assign";

export type TypeParam = {
  name: string;
  constraint?: TsType;
  default?: TsType;
};

export type Accessibility = "public" | "protected" | "private";

export type MethodKind = "method" | "getter" | "setter";

export type Decorator = {
  name: string;
  args?: string[];
};