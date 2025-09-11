# SKMTC - Schema Kit Mapping & Type Conversion

[![npm version](https://img.shields.io/npm/v/@skmtc/core.svg)](https://www.npmjs.com/package/@skmtc/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Deno](https://img.shields.io/badge/Deno-1.46+-black.svg)](https://deno.land/)

**Generate production-ready, type-safe code from OpenAPI specifications in seconds.** SKMTC transforms your OpenAPI v3 documents into fully-typed TypeScript code, React components, API clients, and more.

## ✨ Why SKMTC?

Stop writing boilerplate. Stop maintaining API client code manually. Stop worrying about type mismatches between your frontend and backend.

SKMTC automatically generates:
- ⚡ **Supabase Edge Functions** - Type-safe API endpoints with Hono
- 🔄 **Tanstack Query Hooks** - Data fetching with caching and mutations
- 🛡️ **Zod Schemas** - Runtime validation matching your API specs
- 🎭 **MSW Handlers** - Mock API responses for testing
- 📝 **TypeScript Types** - Full type definitions from your schemas

## 🚀 Quick Start

```bash
# Install globally via npm
npm install -g @skmtc/cli

# Or use directly with npx
npx @skmtc/cli

# Initialize a new project
skmtc init

# Generate code from your OpenAPI spec
skmtc generate
```

That's it! SKMTC will guide you through selecting generators and configuring your output.

## 📸 See It In Action

```typescript
// Before: Manual API client code
const fetchUsers = async () => {
  const response = await fetch('/api/users');
  const data = await response.json();
  // No type safety, manual error handling
  return data;
};

// After: Generated with SKMTC
import { useGetUsers } from './generated/queries';

// Fully typed, with error handling, caching, and more
const { data, error, isLoading } = useGetUsers();
```

## 🎯 Features

### Multiple Code Generators
Choose from our growing collection of generators or create your own:

- **Shadcn UI Components** - Generate data tables, forms, and select components
- **Tanstack Query** - React Query hooks with Zod validation
- **MSW** - Mock Service Worker handlers from OpenAPI examples
- **Zod Schemas** - Runtime validation schemas
- **TypeScript Types** - Pure type definitions
- **Supabase/Hono Functions** - Edge function handlers

### Smart Dependency Resolution
SKMTC automatically manages generator dependencies. When you add a Shadcn table generator, it automatically includes TypeScript types, Zod schemas, and Tanstack Query hooks.

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

### 2. Add Your OpenAPI Specification

Place your OpenAPI spec in your project or provide a URL:

```bash
# Local file
skmtc generate --spec ./openapi.json

# Remote URL
skmtc generate --spec https://api.example.com/openapi.json
```

### 3. Select Generators

Choose which code to generate:

```bash
skmtc add @skmtc/gen-shadcn-table
skmtc add @skmtc/gen-tanstack-query-fetch-zod
```

### 4. Generate Code

```bash
skmtc generate
```

Your generated code appears in the configured output directory, ready to use!

## ❓ FAQ

### **What OpenAPI versions are supported?**
SKMTC supports OpenAPI v3.0+ specifications. We also automatically convert Swagger 2.0 documents.

### **Can I use this with my existing React app?**
Yes! SKMTC generates standalone code that integrates with any React application. The generated components work with your existing setup.

### **How does this compare to OpenAPI Generator?**
SKMTC focuses on modern TypeScript/React ecosystems with better DX, type safety, and React-specific features like hooks and components. We generate idiomatic code that looks hand-written.

### **Can I customize the generated code?**
Yes! Each generator has configuration options, and you can create custom generators for your specific needs. The generated code is also fully editable.

### **Is this production-ready?**
SKMTC is actively used in production environments. We follow semantic versioning and maintain backward compatibility.

### **What about authentication?**
Generated API clients support custom headers, interceptors, and authentication tokens. Configure once, use everywhere.

### **Does it work with Next.js/Remix/Vite?**
Yes! The generated code is framework-agnostic TypeScript/React that works with any modern build tool.

## 🤝 Contributing

We welcome contributions! Check out our [Contributing Guide](CONTRIBUTING.md) to get started.

```bash
# Clone the repo
git clone https://github.com/skmtc/skmtc.git

# Install dependencies
pnpm install

# Run tests
pnpm test
```

## 📚 Documentation

- [Full Documentation](https://docs.skmtc.dev)
- [API Reference](https://docs.skmtc.dev/api)
- [Custom Generators Guide](https://docs.skmtc.dev/generators)
- [Examples](https://github.com/skmtc/skmtc/tree/main/examples)

## 🛟 Support

- [GitHub Issues](https://github.com/skmtc/skmtc/issues) - Bug reports and feature requests
- [Discord Community](https://discord.gg/skmtc) - Get help and share your experience
- [Stack Overflow](https://stackoverflow.com/questions/tagged/skmtc) - Community Q&A

## 📄 License

MIT © [SKMTC Contributors](LICENSE.md)

---

Built with ❤️ by developers, for developers. Transform your API development workflow today.