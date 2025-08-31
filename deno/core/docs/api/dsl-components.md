# DSL Components API

**Learning Outcome:** Use Definition, Identifier, Import, and other DSL classes.

## Identifier

Represents a type-safe identifier with naming conventions.

### Static Methods

#### createType(name: string): Identifier
```typescript
createType(name: string): Identifier
```

Create an identifier for types (interfaces, classes).

**Example:**
```typescript
const userType = Identifier.createType("User")
console.log(userType.name) // "User"
console.log(userType.kind) // "type"
```

#### createValue(name: string): Identifier  
```typescript
createValue(name: string): Identifier
```

Create an identifier for values (functions, variables).

**Example:**
```typescript
const getUserFn = Identifier.createValue("getUser")
console.log(getUserFn.name) // "getUser" 
console.log(getUserFn.kind) // "value"
```

### Properties

```typescript
interface Identifier {
  name: string      // The identifier name
  kind: "type" | "value"  // Whether it's a type or value identifier
}
```

## Definition

Base class for code definitions that can be stringified.

### Constructor

```typescript
class Definition {
  constructor(identifier: Identifier)
}
```

### Properties

```typescript
interface Definition {
  identifier: Identifier  // The definition's identifier
}
```

### Methods

#### toString(): string
```typescript
toString(): string
```

Convert definition to string representation. Must be implemented by subclasses.

**Example:**
```typescript
class MyDefinition extends Definition {
  override toString(): string {
    return `export const ${this.identifier.name} = "value"`
  }
}

const def = new MyDefinition(Identifier.createValue("myConstant"))
console.log(def.toString()) // "export const myConstant = "value""
```

## Import

Represents import statements in generated code.

### Constructor

```typescript
class Import {
  constructor({
    from: string,
    imports?: string[],
    defaultImport?: string,
    namespaceImport?: string
  })
}
```

### Static Methods

#### named(imports: string[], from: string): Import
```typescript
named(imports: string[], from: string): Import
```

Create named imports.

**Example:**
```typescript
const namedImport = Import.named(["User", "Product"], "./types")
console.log(namedImport.toString()) // "import { User, Product } from './types'"
```

#### default(defaultImport: string, from: string): Import
```typescript
default(defaultImport: string, from: string): Import
```

Create default import.

**Example:**
```typescript
const defaultImport = Import.default("React", "react")
console.log(defaultImport.toString()) // "import React from 'react'"
```

#### namespace(namespaceImport: string, from: string): Import
```typescript
namespace(namespaceImport: string, from: string): Import
```

Create namespace import.

**Example:**
```typescript
const nsImport = Import.namespace("fs", "node:fs")
console.log(nsImport.toString()) // "import * as fs from 'node:fs'"
```

### Methods

#### toString(): string
```typescript
toString(): string
```

Generate import statement.

#### addNamed(name: string): Import
```typescript
addNamed(name: string): Import
```

Add named import to existing import.

**Example:**
```typescript
const imp = Import.named(["User"], "./types")
imp.addNamed("Product")
console.log(imp.toString()) // "import { User, Product } from './types'"
```

## Stringable Interface

Interface for objects that can be converted to strings.

```typescript
interface Stringable {
  toString(): string
}
```

Classes that implement Stringable:
- `Definition`
- `Import` 
- `ContentBase` (and subclasses)

## File Class

Represents a complete file with imports and content.

### Constructor

```typescript
class File {
  constructor({
    path: string,
    imports?: Import[],
    content?: Stringable[]
  })
}
```

### Properties

```typescript
interface File {
  path: string           // File path
  imports: Import[]      // Import statements
  content: Stringable[]  // File content
}
```

### Methods

#### addImport(import_: Import): void
```typescript
addImport(import_: Import): void
```

Add import to file.

**Example:**
```typescript
const file = new File({ path: "types/user.ts" })
file.addImport(Import.named(["BaseEntity"], "./base"))
```

#### addContent(content: Stringable): void
```typescript
addContent(content: Stringable): void
```

Add content to file.

**Example:**
```typescript
class UserInterface extends Definition {
  override toString() {
    return "export interface User { id: string }"
  }
}

file.addContent(new UserInterface(Identifier.createType("User")))
```

#### toString(): string
```typescript
toString(): string
```

Generate complete file content with imports and content.

**Example:**
```typescript
const file = new File({ path: "user.ts" })
file.addImport(Import.named(["BaseEntity"], "./base"))
file.addContent(new UserInterface(Identifier.createType("User")))

console.log(file.toString())
// import { BaseEntity } from './base'
// 
// export interface User { id: string }
```

## JsonFile Class

Specialized file for JSON content.

### Constructor

```typescript
class JsonFile {
  constructor({
    path: string,
    content: any
  })
}
```

### Methods

#### toString(): string
```typescript
toString(): string
```

Generate formatted JSON string.

**Example:**
```typescript
const jsonFile = new JsonFile({
  path: "config.json",
  content: { apiUrl: "https://api.example.com", version: "1.0" }
})

console.log(jsonFile.toString())
// {
//   "apiUrl": "https://api.example.com",
//   "version": "1.0"
// }
```

## Usage Patterns

### Building Complex Files

```typescript
const file = new File({ path: "api/users.ts" })

// Add imports
file.addImport(Import.named(["ApiResponse"], "../types"))
file.addImport(Import.default("fetch", "node-fetch"))

// Add multiple definitions
class GetUserFunction extends Definition {
  override toString() {
    return `export async function getUser(id: string): Promise<ApiResponse<User>> {
  const response = await fetch(\`/api/users/\${id}\`)
  return response.json()
}`
  }
}

file.addContent(new GetUserFunction(Identifier.createValue("getUser")))
```

### Import Management

```typescript
// Combine imports from same module
const typeImports = Import.named(["User"], "./types")
typeImports.addNamed("Product")
typeImports.addNamed("Order")

// Result: import { User, Product, Order } from './types'
```

### Type-safe Identifiers

```typescript
// Different identifier types
const userType = Identifier.createType("User")        // For interfaces/types
const createUserFn = Identifier.createValue("createUser")  // For functions/values

// Use in definitions
class TypeDefinition extends Definition {
  constructor(identifier: Identifier) {
    super(identifier)
    if (identifier.kind !== "type") {
      throw new Error("TypeDefinition requires type identifier")
    }
  }
}
```

### JSON Configuration

```typescript
const packageJson = new JsonFile({
  path: "package.json",
  content: {
    name: "my-generated-package",
    version: "1.0.0",
    dependencies: {
      "@skmtc/core": "latest"
    }
  }
})
```

## What You Learned

- `Identifier` provides type-safe naming for types and values
- `Definition` is the base class for code definitions
- `Import` handles all import statement types (named, default, namespace)
- `File` combines imports and content into complete files
- `JsonFile` handles JSON content with formatting
- All DSL components implement `Stringable` interface
- DSL components can be combined to build complex generated files

## What's Next

- **[Helpers API →](helpers.md)** - Utility functions for naming and formatting