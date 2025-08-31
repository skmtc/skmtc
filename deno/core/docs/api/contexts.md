# Contexts API

**Learning Outcome:** Use ParseContext, GenerateContext, and RenderContext methods and properties.

## ParseContext

Handles OpenAPI document parsing and validation.

### Properties

```typescript
interface ParseContext {
  document: OpenAPIV3.Document  // Parsed OpenAPI document
  settings: Settings           // Parser configuration
  log: Logger                  // Logging interface
}
```

### Methods

#### validateDocument()
```typescript
validateDocument(): void
```
Validates the OpenAPI document structure.

**Example:**
```typescript
const parseContext = new ParseContext({ document, settings, log })
parseContext.validateDocument() // Throws if invalid
```

## GenerateContext

Manages generator execution and artifact collection.

### Properties

```typescript
interface GenerateContext {
  document: OpenAPIV3.Document  // Parsed OpenAPI document
  settings: Settings           // Generator configuration
  log: Logger                  // Logging interface
  artifacts: Map<string, any>  // Collected artifacts
}
```

### Methods

#### register(args: RegisterArgs)
```typescript
interface RegisterArgs {
  exportPath: string
  content: string | ContentBase
}

register(args: RegisterArgs): void
```

Register an artifact to be rendered.

**Example:**
```typescript
context.register({
  exportPath: "@/types/user.generated.ts",
  content: "export interface User { id: string }"
})
```

#### trace(name: string, fn: () => T): T
```typescript
trace<T>(name: string, fn: () => T): T
```

Execute function with tracing.

**Example:**
```typescript
const result = context.trace("generate-user-types", () => {
  return generateComplexTypes()
})
```

#### getArtifact(path: string): any | undefined
```typescript
getArtifact(path: string): any | undefined
```

Retrieve previously registered artifact.

**Example:**
```typescript
const existingTypes = context.getArtifact("@/types/common.ts")
if (existingTypes) {
  // Extend existing types
}
```

## RenderContext

Handles file writing and code formatting.

### Properties

```typescript
interface RenderContext {
  artifacts: Map<string, any>   // Artifacts to render
  settings: Settings           // Render configuration
  log: Logger                  // Logging interface
  prettierConfig?: PrettierConfig // Code formatting config
}
```

### Methods

#### writeFile(path: string, content: string)
```typescript
writeFile(path: string, content: string): Promise<void>
```

Write formatted content to file.

**Example:**
```typescript
await renderContext.writeFile(
  "src/types/user.ts", 
  "export interface User { id: string }"
)
```

#### formatCode(content: string, parser?: string)
```typescript
formatCode(content: string, parser?: string): Promise<string>
```

Format code with Prettier.

**Example:**
```typescript
const formatted = await renderContext.formatCode(
  "export interface User{id:string}",
  "typescript"
)
// Returns: "export interface User {\n  id: string;\n}"
```

## Logger Interface

All contexts include a logger for debugging and monitoring.

```typescript
interface Logger {
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, meta?: any): void
}
```

**Example:**
```typescript
context.log.info("Starting generation", { schemas: schemaCount })
context.log.warn("Schema missing description", { schemaName })
context.log.error("Generation failed", { error, context: additionalInfo })
```

## Settings Interface

Configuration object passed through all contexts.

```typescript
interface Settings {
  // Generator-specific settings
  [key: string]: any
  
  // Common settings
  prettierConfig?: PrettierConfig
  outputDirectory?: string
  skipValidation?: boolean
}
```

**Example:**
```typescript
const settings = {
  outputDirectory: "src/generated",
  prettierConfig: {
    semi: false,
    singleQuote: true
  },
  // Custom generator settings
  includeComments: true,
  useOptionalProperties: false
}
```

## Context Creation

Contexts are created automatically by `toArtifacts()`, but you can create them manually for testing:

```typescript
import { ParseContext, GenerateContext, RenderContext } from "@skmtc/core"

// Manual context creation
const parseContext = new ParseContext({
  document: openApiDocument,
  settings: {},
  log: console
})

const generateContext = new GenerateContext({
  parseContext,
  settings: {},
  log: console
})

const renderContext = new RenderContext({
  artifacts: generateContext.artifacts,
  settings: {},
  log: console
})
```

## Context Flow

Understanding how contexts pass data:

```typescript
// 1. Parse Phase
const parseContext = new ParseContext({ document, settings, log })
const parsedDocument = parseContext.document

// 2. Generate Phase  
const generateContext = new GenerateContext({ parseContext, settings, log })
generators.forEach(generator => generator.execute(generateContext))

// 3. Render Phase
const renderContext = new RenderContext({
  artifacts: generateContext.artifacts,
  settings, 
  log
})
await renderContext.writeAllFiles()
```

## Error Handling

All contexts provide error logging:

```typescript
try {
  context.validateDocument()
} catch (error) {
  context.log.error("Validation failed", { error, document })
  throw error
}
```

## Advanced Usage

### Custom Logger

```typescript
const customLogger = {
  info: (msg, meta) => console.log(`[INFO] ${msg}`, meta),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta)
}

const context = new GenerateContext({
  parseContext,
  settings: {},
  log: customLogger
})
```

### Artifact Inspection

```typescript
context.register({ exportPath: "file1.ts", content: "content1" })
context.register({ exportPath: "file2.ts", content: "content2" })

// Inspect all artifacts
for (const [path, content] of context.artifacts) {
  console.log(`${path}: ${content.length} chars`)
}
```

### Conditional Registration

```typescript
if (context.getArtifact("@/types/base.ts")) {
  // Base types already exist, extend them
  context.register({
    exportPath: "@/types/extensions.ts",
    content: generateExtensions()
  })
}
```

## What You Learned

- ParseContext handles document validation and parsing
- GenerateContext manages artifact collection and tracing  
- RenderContext handles file writing and formatting
- All contexts provide logging capabilities
- `register()` adds artifacts to the generation pipeline
- `trace()` provides performance monitoring
- Settings flow through all context phases

## What's Next

- **[DSL Components →](dsl-components.md)** - Definition and Identifier classes
- **[Helpers API →](helpers.md)** - Utility functions reference