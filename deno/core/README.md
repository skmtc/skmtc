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

Skmtc is a Deno CLI. Install it from JSR:

```bash
deno install -g -A --unstable-worker-options jsr:@skmtc/cli -n skmtc -f
```

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

```typescript
import {
  toOasOperationEntry,
  toOasOperationProjectionBase,
  Identifier
} from '@skmtc/core'
import { ZodProjection } from '@skmtc/gen-zod'
import denoJson from '../deno.json' with { type: 'json' }

// Build a per-generator projection base via the factory.
const ZodFetchBase = toOasOperationProjectionBase({
  id: denoJson.name,
  toIdentifier: ({ operation }) =>
    Identifier.createVariable(`fetch${operation.operationId}`),
  toExportPath: ({ operation }) =>
    `@/services/${operation.operationId}.generated.ts`
})

class ZodFetch extends ZodFetchBase {
  zodName: string

  constructor(args: ConstructorParameters<typeof ZodFetchBase>[0]) {
    super(args)

    // Insert a Zod schema for the success response into the same file.
    const response = this.operation.toSuccessResponse()?.resolve().toSchema()
    const zodResponse = this.insertNormalizedModel(ZodProjection, {
      schema: response,
      fallbackName: `${this.operation.operationId}Response`
    })

    // Grab the Zod identifier so toString() can reference it.
    this.zodName = zodResponse.identifier.name
  }

  override toString(): string {
    return `async () => {
      const res = await fetch('${this.operation.path}')
      const data = await res.json()
      return ${this.zodName}.parse(data)
    }`
  }
}

// Wire it up so the engine dispatches against OAS operations.
export const zodFetchEntry = toOasOperationEntry({
  id: denoJson.name,
  isSupported: () => true,
  transform: ({ context, operation }) => {
    context.insertOperation(ZodFetch, operation)
  }
})
```

## 📦 Available Generators

Stock generators on JSR (under `@skmtc/`):

- **Model generators** — `gen-typescript`, `gen-zod`, `gen-valibot`, `gen-arktype`
- **HTTP client generators** — `gen-tanstack-query-fetch-zod`, `gen-tanstack-query-supabase-zod`
- **Form generators** — `gen-shadcn-form`, `gen-daisyui-form`
- **UI generators** — `gen-shadcn-select`, `gen-shadcn-table`
- **Mocks** — `gen-msw`
- **Backend** — `gen-supabase-hono`, `gen-express`
- **GraphQL** — `gen-graphql-operation`, `gen-graphql-typed-document-node`
- **Reapit-flavoured variants** — `gen-reapit-form`, `gen-reapit-graphql-client`, `gen-reapit-multi-select`, `gen-reapit-searchable-dropdown`

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