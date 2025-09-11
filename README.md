# Skmtc

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Deno](https://img.shields.io/badge/Deno-2.5+-black.svg)](https://deno.land/)

**Generate production-ready, type-safe code from OpenAPI specifications in seconds.** Skmtc transforms your OpenAPI v3 documents into fully-typed TypeScript code, React components, API clients, and more.

## ✨ Why Skmtc?

- 🧵 **Easy to edit code generators** - Outputs specified using string templates, not ASTs
- 🥞 **Stackable generators** - Combine multiple generators to generate deep functionality
- 🗄️ **Use your own code conventions** - Full control over naming and file structure
- 🎨 **Formatted output** - Prettier integration for consistent styling
- 🍱 **Choose from 11 ready-to-use generators** - Generators include Tanstack Query, Zod, TypeScript, and more - https://github.com/skmtc/skmtc-generators

## 🚀 Quick Start

```bash
# Install globally via npm
npm install -g @skmtc

# Or use directly with npx
npx skmtc

# Initialize a new project
skmtc init

# Generate code from your OpenAPI spec
skmtc generate
```

That's it! Skmtc will guide you through selecting generators and configuring your output.

## 🎯 Features

### Single ecosystem for code generators
Choose from our growing collection of generators, combone them or create your own:

- **Tanstack Query** - React Query hooks with Zod validation
- **MSW** - Mock Service Worker handlers from OpenAPI examples
- **Zod Schemas** - Runtime validation schemas
- **TypeScript Types** - Pure type definitions
- **Supabase/Hono Functions** - Edge function handlers

### Smart Dependency Resolution
Skmtc automatically manages generator dependencies. When you add a Shadcn table generator, it automatically includes TypeScript types, Zod schemas, and Tanstack Query hooks.

### Three-Phase Pipeline
Our robust architecture ensures reliable code generation:
1. **Parse** - Validates and processes your OpenAPI document
2. **Generate** - Transforms schemas into language-specific artifacts  
3. **Render** - Formats and writes files with proper styling

### Developer Experience First
- 🎯 **Interactive CLI** - Guided setup and configuration
- 🔥 **Hot Reload** - Watch mode for automatic regeneration
- 📦 **Monorepo Support** - Works with Turborepo, Nx, and more
- 🎨 **Prettier Integration** - Auto-formatted output
- 🔍 **Type Safety** - Full TypeScript support throughout

## 🏃 Getting Started

### 1. Initialize Your Project

```bash
skmtc init
```

This creates a `.skmtc` folder with your project configuration.

### 2. Select Generators

Choose which code to generate:

```bash
skmtc install @skmtc/gen-shadcn-table
skmtc install @skmtc/gen-tanstack-query-fetch-zod
```

### 3. Generate Code

```bash
# Local file
skmtc generate ./openapi.json

# Remote URL
skmtc generate https://api.example.com/openapi.json
```

Your generated code appears in the configured output directory, ready to use!

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

### **Is this production-ready?**
Skmtc is actively used in production environments. We follow semantic versioning and maintain backward compatibility.

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
- [Discord Community](https://discord.gg/ndr8YpxZ) - Get help and share your experience

## 📄 License

Apache 2.0 © [Skmtc Contributors](LICENSE.md)

---

Built with ❤️ by developers, for developers. Transform your API development workflow today.