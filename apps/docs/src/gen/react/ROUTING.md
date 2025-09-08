# DocsApp Routing System

The `DocsApp` component supports flexible routing to display different documentation pages based on URL slugs.

## Slug-based Routing (Primary)

The `slug` prop accepts a string array that determines which page to render:

### Index Page
```typescript
<DocsApp docsData={data} slug={[]} />
<DocsApp docsData={data} slug={undefined} />
```
- Empty array or undefined displays the index page
- Shows module documentation and overview content

### Symbol Pages
```typescript
<DocsApp docsData={data} slug={["functionName"]} />
<DocsApp docsData={data} slug={["ClassName"]} />
```
- Single element array looks for exact symbol name match
- Case-insensitive matching (`"myfunction"` matches `"MyFunction"`)

### Nested Symbol Pages
```typescript
<DocsApp docsData={data} slug={["Namespace", "NestedSymbol"]} />
<DocsApp docsData={data} slug={["utils", "helper", "parseData"]} />
```
- Multiple elements joined with `/` to form path: `"Namespace/NestedSymbol"`
- Useful for namespaced or nested symbols

## Symbol Matching Logic

1. **Join slug array**: `["utils", "parseData"]` → `"utils/parseData"`
2. **Clean path**: Remove leading slashes
3. **Find symbol**: Search `docsData.nodes` for matching `name`
4. **Case-insensitive fallback**: If exact match fails, try lowercase comparison

```typescript
const symbol = docsData.nodes.find(node => 
  node.name === cleanSlug || 
  node.name.toLowerCase() === cleanSlug.toLowerCase()
)
```

## Legacy Routing (Fallback)

For backwards compatibility, the component still supports the old routing system:

```typescript
<DocsApp 
  docsData={data}
  pageType="symbol"
  symbolName="functionName" 
/>
```

This will be used if the slug-based routing doesn't find a match.

## Routing Priority

1. **Slug-based routing** (if `slug` prop provided and matches a symbol)
2. **Legacy routing** (if `pageType="symbol"` and `symbolName` provided)
3. **Default index page** (if no matches found)

## Examples

### Next.js Dynamic Routing
```typescript
// pages/[...slug].tsx
export default function DocsPage({ slug, docsData }) {
  return <DocsApp docsData={docsData} slug={slug} />
}

export async function getStaticPaths() {
  return {
    paths: [
      { params: { slug: [] } },           // /
      { params: { slug: ['myFunction'] } }, // /myFunction
      { params: { slug: ['utils', 'helper'] } } // /utils/helper
    ],
    fallback: false
  }
}
```

### React Router
```typescript
import { useParams } from 'react-router-dom'

function DocsRoute({ docsData }) {
  const { '*': splat } = useParams()
  const slug = splat ? splat.split('/').filter(Boolean) : []
  
  return <DocsApp docsData={docsData} slug={slug} />
}
```

## URL Structure Examples

| URL | Slug Array | Result |
|-----|------------|--------|
| `/` | `[]` | Index page |
| `/myFunction` | `["myFunction"]` | Function page |
| `/MyClass` | `["MyClass"]` | Class page |
| `/utils/parseData` | `["utils", "parseData"]` | Nested symbol page |
| `/api/v1/User` | `["api", "v1", "User"]` | Deep nested symbol |

This flexible routing system allows the React documentation generator to work seamlessly with any routing framework while maintaining backwards compatibility.