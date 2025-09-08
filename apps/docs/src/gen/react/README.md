# React Documentation Generator

This directory contains a complete React component library that mirrors the HBS template structure used for generating documentation. The components generate identical HTML output to the original HBS templates while providing a React-based alternative.

## Architecture

### Entry Point
- **`DocsApp.tsx`** - Main component that receives `DocsJson` data and renders complete documentation pages

### Page Components
- **`IndexPage.tsx`** - Main landing page layout (mirrors `pages/index.hbs`)
- **`SymbolPage.tsx`** - Symbol detail page layout (mirrors `pages/symbol.hbs`) 
- **`HtmlHead.tsx`** - Document head with meta tags (mirrors `pages/html_head.hbs`)

### Layout Components
- **`TopNav.tsx`** - Navigation bar with search and theme toggle
- **`CategoryPanel.tsx`** - Left sidebar with categories and symbol links
- **`Breadcrumbs.tsx`** - Navigation breadcrumb trail
- **`Toc.tsx`** - Table of contents sidebar

### Content Components
- **`SymbolGroup.tsx`** - Container for grouped symbols
- **`SymbolContent.tsx`** - Renders symbol documentation sections
- **`DocEntry.tsx`** - Individual documentation entry
- **`Function.tsx`** - Function-specific documentation
- **`Section.tsx`** - Generic content section wrapper
- **`ModuleDoc.tsx`** - Module-level documentation
- **`Usages.tsx`** - Usage examples with framework selection
- **`Example.tsx`** - Code examples with syntax highlighting

### Atomic Components
- **`Anchor.tsx`** - Linkable anchors for headings
- **`Tag.tsx`** - Symbol tags (deprecated, experimental, etc.)
- **`SourceButton.tsx`** - Link to source code
- **`Deprecated.tsx`** - Deprecation warnings
- **`SearchResults.tsx`** - Search results container
- **`DocNodeKindIcon.tsx`** - Icons for different symbol types

### Icons
- **`Icon.tsx`** - SVG icon components (Link, Arrow, Moon, Sun, Source, etc.)

### Utilities
- **`types.ts`** - Re-exports DocsJson type definitions
- **`utils.ts`** - Helper functions for processing DocsJson data
- **`example.tsx`** - Sample usage demonstration

## Usage

### Basic Usage

```typescript
import { DocsApp } from './src/gen/react';
import { DocsJson } from './src/gen/docs-types';

const myDocsData: DocsJson = {
  version: 1,
  nodes: [
    // ... your documentation nodes
  ]
};

// Index page (root)
const App = () => (
  <DocsApp 
    docsData={myDocsData}
    slug={[]}
    pageConfig={{
      title: "My Documentation",
      stylesheetUrl: "/styles.css"
    }}
  />
);
```

### Symbol Pages (Slug-based Routing)

```typescript
// Function page
const FunctionApp = () => (
  <DocsApp 
    docsData={myDocsData}
    slug={["myFunction"]}
    breadcrumbs={[
      { name: "Home", href: "/" },
      { name: "myFunction", isSymbol: true }
    ]}
  />
);

// Class page
const ClassApp = () => (
  <DocsApp 
    docsData={myDocsData}
    slug={["MyClass"]}
    breadcrumbs={[
      { name: "Home", href: "/" },
      { name: "MyClass", isSymbol: true }
    ]}
  />
);

// Nested namespace symbol
const NestedApp = () => (
  <DocsApp 
    docsData={myDocsData}
    slug={["MyNamespace", "NestedFunction"]}
    breadcrumbs={[
      { name: "Home", href: "/" },
      { name: "MyNamespace.NestedFunction", isSymbol: true }
    ]}
  />
);
```

### Legacy Symbol Page (Backwards Compatible)

```typescript
const LegacySymbolApp = () => (
  <DocsApp 
    docsData={myDocsData}
    pageType="symbol" 
    symbolName="myFunction"
    breadcrumbs={[
      { name: "Home", href: "/" },
      { name: "myFunction", isSymbol: true }
    ]}
  />
);
```

### Individual Components

```typescript
import { DocEntry, Tag, Anchor } from './src/gen/react';

const MyComponent = () => (
  <DocEntry
    id="my-function"
    name="myFunction"
    content="(input: string) => string"
    tags={[{ kind: "experimental" }]}
    jsDoc="<p>This function processes strings.</p>"
  />
);
```

## Props Interface

### DocsApp Props
- `docsData: DocsJson` - The documentation data
- `slug?: string[]` - **Primary routing method** - URL slug array to determine which page to show:
  - `[]` or `undefined` → Index page
  - `["symbolName"]` → Symbol page for that symbol
  - `["namespace", "symbolName"]` → Nested symbol page (joined as "namespace/symbolName")
  - Automatically finds matching symbol by name (case-insensitive)
- `pageType?: 'index' | 'symbol'` - **Legacy routing** - Type of page to render (fallback)
- `symbolName?` - **Legacy routing** - For symbol pages, the symbol to display (fallback)
- `pageConfig?` - Page configuration (title, stylesheets, scripts)
- `categories?` - Navigation categories
- `breadcrumbs?` - Breadcrumb navigation
- `usage?` - Usage examples

#### Routing Priority
1. **Slug-based** (recommended): Uses `slug` array joined with '/' to find matching symbol
2. **Legacy fallback**: Uses `pageType` + `symbolName` if slug doesn't match
3. **Default**: Shows index page if no matches found

## HTML Output Compatibility

The React components generate HTML that is structurally identical to the HBS templates:

- Same CSS class names
- Same DOM structure  
- Same `id` attributes for anchors
- Same data attributes
- Same JavaScript integration points

This ensures that existing stylesheets and JavaScript will work without modification.

## Type Safety

All components are fully typed using the `DocsJson` type definitions, providing:
- IntelliSense support
- Compile-time error checking
- Accurate prop validation
- Type-safe data transformations

## Customization

Components can be used individually and customized:

```typescript
import { TopNav, CategoryPanel } from './src/gen/react';

const CustomLayout = () => (
  <div>
    <TopNav disableSearch />
    <CategoryPanel 
      categories={myCategories}
      totalSymbols={100}
    />
  </div>
);
```

## Integration

The React components can be integrated into any React application or used with server-side rendering frameworks like Next.js to generate static documentation sites.