<p align="center">
  <img src="./skmtc.svg" />
</p>

![Coverage](https://raw.githubusercontent.com/skmtc/skmtc/gh-pages/badges/cli/coverage.svg)

**Skmtc is a declarative code generation framework**. It lets you generate TypeScript code from OpenAPI schemas without complex ASTs.

## ✨ Features

- 🏎️ **Fast** - Generates 550k+ tokens per second
- 🧵 **Easy to edit code generators** - Outputs specified using string templates, not ASTs
- 🥞 **Stackable generators** - Compose complex functionality by combining generators
- 🗄️ **Use your own code conventions** - Full control over naming and file structure

## 🚀 Quick Start

```bash
# Run directly with npx
npx skmtc

```

### Running code generators

```bash
npx skmtc generate @skmtc/supabase-backend https://petstore3.swagger.io/api/v3/openapi.json
# Generated 9 files (507 lines, 3,383 tokens) in 9ms

npx skmtc generate @skmtc/supabase-react-client https://raw.githubusercontent.com/cloudflare/api-schemas/refs/heads/main/openapi.json
# Generated 6,797 files (104,752 lines, 1,635,227 tokens) in 2,969ms
```

### Example generator code

```typescript
import { ZodInsertable } from '@skmtc/gen-zod'

class ZodFetch extends BaseTransformer {
  zodName: string;

  constructor({context, operation, settings}){
    super({context, operation, settings})

    // Generate Zod schema for API response and insert it into current file
    const response = operation.toSuccessResponse()?.resolve().toSchema()
    const zodResponse = this.insert(ZodInsertable, response)

    // Grab Zod schema name to use in output code
    this.zodName = zodResponse.identifier.name
  }

  // Define code output
  toString(){
    return `() => {
      const res = await fetch('${this.operation.path}')
      const data = await res.json()

      return ${zodName}.parse(data)
    }`
  }
}
```

## 📦 Available Generators

Choose from our growing collection of generators, combone them or create your own:

- **Tanstack Query** - React Query hooks with Zod validation
- **MSW** - Mock Service Worker handlers from OpenAPI examples
- **Zod Schemas** - Runtime validation schemas
- **TypeScript Types** - Pure type definitions
- **Supabase/Hono Functions** - Edge function handlers
- See full list at https://github.com/skmtc/skmtc-generators

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

## 🛠️ Local development

For day-to-day work the published JSR install is the right choice:

```bash
deno install -g -A --unstable-worker-options jsr:@skmtc/cli@<version> -n skmtc -f
```

To install a binary that tracks your **local checkout** instead, use `deno compile` rather than `deno install`:

```bash
deno compile --no-check --allow-all \
  --config /path/to/skmtc/deno/cli/deno.json \
  --include /path/to/skmtc/deno/cli \
  -o ~/.deno/bin/skmtc \
  /path/to/skmtc/deno/cli/mod.ts
```

`deno install` against local source is not supported because the CLI uses dynamic imports with the `@/` alias (`await import('@/commands/init.tsx')`). When you publish to JSR, `deno publish` resolves alias specifiers in the artifact (so the JSR copy ships with relative paths and `deno install jsr:@skmtc/cli` works). When installing from local source no such resolution happens, and the launcher's runtime cwd cannot resolve `@/` against the original `deno.json`. `deno compile --include` sidesteps this by bundling the entire CLI directory at build time.

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