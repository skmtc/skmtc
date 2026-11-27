<p align="center">
  <img src="./skmtc.svg" />
</p>

**Skmtc is a declarative code generation framework**. It lets you generate TypeScript code from OpenAPI schemas without complex ASTs.

## ✨ Features

- 🏎️ **Fast** - Generates 550k+ tokens per second
- 🧵 **Easy to edit code generators** - Outputs specified using string templates, not ASTs
- 🥞 **Stackable generators** - Compose complex functionality by combining generators
- 🗄️ **Use your own code conventions** - Full control over naming and file structure

## 🚀 Quick Start

Skmtc is a Deno CLI. Install the latest version on macOS and Linux with:

```bash
curl -fsSL https://skmtc.dev/install | sh
```

On Windows, in PowerShell:

```powershell
irm https://skmtc.dev/install.ps1 | iex
```

This bootstraps [Deno](https://deno.com) (the runtime) automatically if needed.

### Running code generators

```bash
# Scaffold a project (project name + basePath under the consuming app)
skmtc init petstore src/generated

# Add a generator from JSR
skmtc install @skmtc/gen-zod petstore

# Run the pipeline against a schema URL or local path
skmtc generate petstore https://petstore3.swagger.io/api/v3/openapi.json
```

### Example generator code

A whole generator, in one file. It writes one `fetch` function for each
operation of the document.

```ts
import {
  decapitalize,
  type EmptyEnrichments,
  emptyEnrichmentSchema,
  type OasOperationProjectionConstructorArgs,
  toEndpointName,
  toOasOperationEntry
} from '@skmtc/core'
import { toStringLiteral, toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'

const ID = '@acme/gen-fetch'

// This generator takes no settings from its consumer.
const toEnrichmentSchema = () => emptyEnrichmentSchema

// The name and the export path of each definition are decided here, once.
const FetchBase = toTsOasOperationProjectionBase<EmptyEnrichments>({
  id: ID,

  // Method and path, never operationId: `POST /search` is `createApiSearch`.
  toIdentifierName: ({ operation }) => decapitalize(toEndpointName(operation)),

  toIdentifierType: () => ({ type: 'variable' }),

  toExportPath({ operation, enrichments, variant }) {
    return `@/api/${this.toIdentifierName({ operation, enrichments, variant })}.generated.ts`
  },

  toEnrichmentSchema
})

// A producer: the constructor stores the parts, and toString() arranges them.
class FetchEndpoint extends FetchBase {
  method: string
  path: string

  constructor(args: OasOperationProjectionConstructorArgs<EmptyEnrichments>) {
    super(args)

    this.method = toStringLiteral(this.operation.method.toUpperCase())
    this.path = toStringLiteral(this.operation.path)
  }

  override toString(): string {
    return `() => fetch(${this.path}, { method: ${this.method} })`
  }
}

// The engine runs the entry once for each operation of the document.
export default toOasOperationEntry<EmptyEnrichments>({
  id: ID,
  toEnrichmentSchema,
  transform({ context, operation, variant }) {
    context.insertOperation({ projection: FetchEndpoint, operation, variant })
  }
})
```

For a document with `GET /pets` and `POST /search`, it writes two files:

```ts
// api/getApiPets.generated.ts
export const getApiPets = () => fetch('/pets', { method: 'GET' });

// api/createApiSearch.generated.ts
export const createApiSearch = () => fetch('/search', { method: 'POST' });
```

`deno task verify-docs` type-checks this example against the packages in
this repository, so it compiles with the version you read it beside.

## 📦 Available Generators

Stock generators on JSR (under `@skmtc/`):

- **Model generators** — `gen-typescript`, `gen-zod`, `gen-valibot`, `gen-arktype`
- **HTTP client generators** — `gen-tanstack-query-fetch-zod`, `gen-tanstack-query-supabase-zod`
- **Form generators** — `gen-shadcn-form`, `gen-daisyui-form`
- **UI generators** — `gen-shadcn-select`, `gen-shadcn-table`
- **Mocks** — `gen-msw`
- **Backend** — `gen-supabase-hono`, `gen-express`
- **GraphQL** — `gen-graphql-operation`, `gen-graphql-typed-document-node`

The full set lives at https://github.com/skmtc/skmtc-generators
and on JSR at https://jsr.io/@skmtc.

## ❓ FAQ

### **What OpenAPI versions are supported?**
Skmtc supports OpenAPI v3.0. Swagger 2.0 and OpenAPI v3.1 are automatically converted to OpenAPI v3.0.

### **Can I customize the generated code?**
Yes! Each Transformer specifies its output using plain string templates, which means you can
edit them as would you edit any other code.

### **Can I use this with my existing React app?**
Yes! Skmtc generates standalone code that integrates with any React application. The generated components work with your existing setup.

### **How does this compare to OpenAPI Generator?**
Skmtc is the only code generation framework that provides full control over the generated code. You are not limited by library-specific settings and you do not need to write complex AST code.

### **Does it work with Next.js/Remix/Vite?**
Yes! The generated code is framework-agnostic TypeScript that works with any build tool or library.

## 🤝 Contributing

We welcome contributions! Check out our [Contributing Guide](CONTRIBUTING.md) to get started.

<!-- ## 📚 Documentation

- [Full Documentation](https://docs.skmtc.dev)
- [API Reference](https://docs.skmtc.dev/api)
- [Custom Generators Guide](https://docs.skmtc.dev/generators)
- [Examples](https://github.com/skmtc/skmtc/tree/main/examples) -->

## 🛟 Support

- [GitHub Issues](https://github.com/skmtc/skmtc/issues) - Bug reports and feature requests
- [Discord Community](https://discord.com/invite/Mg88C8Xu5Y) - Get help and share your experience

## 📄 License

Apache 2.0 © [Skmtc Contributors](LICENSE.md)

---

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-green.svg)](https://opensource.org/licenses/Apache-2.0)
[![Deno](https://img.shields.io/badge/Deno-2.5+-green.svg)](https://deno.land/)
[![Discord](https://img.shields.io/badge/Discord-join%20chat-1dce73.svg)](https://discord.com/invite/Mg88C8Xu5Y)