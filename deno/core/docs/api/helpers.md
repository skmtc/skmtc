# Helpers API

**Learning Outcome:** Use utility functions for naming, formatting, and string manipulation.

## Naming Functions

### camelCase(str: string): string
Convert string to camelCase.

```typescript
import { camelCase } from "@skmtc/core"

camelCase("user_name")     // "userName"
camelCase("api-endpoint")  // "apiEndpoint" 
camelCase("HTTP Response") // "httpResponse"
```

### capitalize(str: string): string
Capitalize first letter.

```typescript
import { capitalize } from "@skmtc/core"

capitalize("user")      // "User"
capitalize("userName")  // "UserName"
capitalize("API")       // "API"
```

### decapitalize(str: string): string
Lowercase first letter.

```typescript
import { decapitalize } from "@skmtc/core"

decapitalize("User")     // "user"
decapitalize("UserName") // "userName"
decapitalize("API")      // "aPI"
```

### kebabCase(str: string): string
Convert string to kebab-case.

```typescript
import { kebabCase } from "@skmtc/core"

kebabCase("userName")    // "user-name"
kebabCase("APIEndpoint") // "api-endpoint"
kebabCase("user_email")  // "user-email"
```

### snakeCase(str: string): string
Convert string to snake_case.

```typescript
import { snakeCase } from "@skmtc/core"

snakeCase("userName")    // "user_name"
snakeCase("APIEndpoint") // "api_endpoint"
snakeCase("user-email")  // "user_email"
```

## String Utilities

### isEmpty(value: any): boolean
Check if value is empty (null, undefined, empty string, empty array/object).

```typescript
import { isEmpty } from "@skmtc/core"

isEmpty("")           // true
isEmpty(null)         // true
isEmpty(undefined)    // true
isEmpty([])           // true
isEmpty({})           // true
isEmpty("hello")      // false
isEmpty([1, 2, 3])    // false
```

### formatNumber(num: number, precision?: number): string
Format number with specified precision.

```typescript
import { formatNumber } from "@skmtc/core"

formatNumber(1234.567)     // "1,234.567"
formatNumber(1234.567, 2)  // "1,234.57" 
formatNumber(1000)         // "1,000"
```

### parseModuleName(path: string): { name: string, scope?: string }
Parse module name and scope from import path.

```typescript
import { parseModuleName } from "@skmtc/core"

parseModuleName("@skmtc/core")           // { name: "core", scope: "skmtc" }
parseModuleName("react")                 // { name: "react" }
parseModuleName("@types/node")           // { name: "node", scope: "types" }
parseModuleName("./local-module")        // { name: "local-module" }
```

## Path Utilities

### toResolvedArtifactPath(exportPath: string, baseDir?: string): string
Resolve artifact export path to absolute file path.

```typescript
import { toResolvedArtifactPath } from "@skmtc/core"

toResolvedArtifactPath("@/types/user.ts")              // "./types/user.ts"
toResolvedArtifactPath("@/api/client.ts", "src")       // "src/api/client.ts"
toResolvedArtifactPath("./components/Button.tsx")      // "./components/Button.tsx"
```

## Reference Utilities

### refFns.extractRefName(ref: string): string
Extract reference name from $ref string.

```typescript
import { refFns } from "@skmtc/core"

refFns.extractRefName("#/components/schemas/User")     // "User"
refFns.extractRefName("#/components/parameters/Id")   // "Id"
refFns.extractRefName("external.yaml#/User")          // "User"
```

### refFns.isLocalRef(ref: string): boolean
Check if reference is local (same document).

```typescript
import { refFns } from "@skmtc/core"

refFns.isLocalRef("#/components/schemas/User")        // true
refFns.isLocalRef("external.yaml#/User")              // false
refFns.isLocalRef("https://api.com/schema#/User")     // false
```

### refFns.buildRef(section: string, name: string): string
Build reference string.

```typescript
import { refFns } from "@skmtc/core"

refFns.buildRef("schemas", "User")        // "#/components/schemas/User"
refFns.buildRef("parameters", "PageSize") // "#/components/parameters/PageSize"
refFns.buildRef("responses", "Error")     // "#/components/responses/Error"
```

## Import Utilities

### isImported(identifier: string, imports: Import[]): boolean
Check if identifier is already imported.

```typescript
import { isImported, Import } from "@skmtc/core"

const imports = [
  Import.named(["User", "Product"], "./types"),
  Import.default("React", "react")
]

isImported("User", imports)      // true
isImported("React", imports)     // true
isImported("Component", imports) // false
```

## Example Validation

### collateExamples(examples: any[]): Record<string, any>
Collate and validate examples from OpenAPI schema.

```typescript
import { collateExamples } from "@skmtc/core"

const examples = [
  { name: "success", value: { id: 1, name: "John" } },
  { name: "error", value: { error: "Not found" } }
]

const collated = collateExamples(examples)
// {
//   success: { id: 1, name: "John" },
//   error: { error: "Not found" }
// }
```

## Generation Stats

### generationStats(artifacts: Map<string, any>): GenerationStats
Calculate generation statistics.

```typescript
import { generationStats } from "@skmtc/core"

const stats = generationStats(artifacts)
// {
//   fileCount: 12,
//   totalLines: 450,
//   totalSize: 15420, // bytes
//   averageFileSize: 1285
// }
```

## Usage Patterns

### File Naming Convention

```typescript
import { camelCase, capitalize, kebabCase } from "@skmtc/core"

function getFileNames(schemaName: string) {
  return {
    type: `${capitalize(camelCase(schemaName))}.ts`,           // "UserProfile.ts"
    api: `${camelCase(schemaName)}.api.ts`,                   // "userProfile.api.ts" 
    test: `${kebabCase(schemaName)}.test.ts`,                 // "user-profile.test.ts"
    docs: `${kebabCase(schemaName)}.md`                       // "user-profile.md"
  }
}
```

### Path Resolution

```typescript
import { toResolvedArtifactPath } from "@skmtc/core"

function generateFileArtifact(exportPath: string, content: string) {
  const resolvedPath = toResolvedArtifactPath(exportPath)
  
  return {
    path: resolvedPath,
    content,
    directory: path.dirname(resolvedPath),
    filename: path.basename(resolvedPath)
  }
}
```

### Reference Handling

```typescript
import { refFns } from "@skmtc/core"

function processSchemaRefs(schema: any): string[] {
  const refs = []
  
  if (schema.$ref && refFns.isLocalRef(schema.$ref)) {
    refs.push(refFns.extractRefName(schema.$ref))
  }
  
  if (schema.properties) {
    Object.values(schema.properties).forEach(prop => {
      if (prop.$ref) {
        refs.push(refFns.extractRefName(prop.$ref))
      }
    })
  }
  
  return [...new Set(refs)] // Deduplicate
}
```

### Import Management

```typescript
import { isImported, Import } from "@skmtc/core"

class ImportManager {
  private imports: Import[] = []
  
  addImport(names: string[], from: string) {
    const existing = this.imports.find(imp => imp.from === from)
    
    if (existing) {
      names.forEach(name => {
        if (!isImported(name, this.imports)) {
          existing.addNamed(name)
        }
      })
    } else {
      this.imports.push(Import.named(names, from))
    }
  }
  
  toString(): string {
    return this.imports.map(imp => imp.toString()).join('\n')
  }
}
```

### Validation and Stats

```typescript
import { isEmpty, generationStats, collateExamples } from "@skmtc/core"

function validateAndReport(artifacts: Map<string, any>) {
  // Remove empty artifacts
  const filtered = new Map()
  for (const [path, content] of artifacts) {
    if (!isEmpty(content)) {
      filtered.set(path, content)
    }
  }
  
  // Generate report
  const stats = generationStats(filtered)
  console.log(`Generated ${stats.fileCount} files, ${stats.totalLines} lines`)
  
  return filtered
}
```

## What You Learned

- Naming functions provide consistent case conversion
- String utilities handle empty values and formatting
- Path utilities resolve export paths to file paths
- Reference utilities parse and build OpenAPI $ref strings
- Import utilities manage import deduplication
- Generation utilities provide validation and statistics
- Helper functions can be combined for complex operations

This completes the API reference documentation for @skmtc/core. The documentation now provides comprehensive coverage from quick start through advanced API usage.