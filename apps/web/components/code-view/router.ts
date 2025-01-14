export class Router {
  previews: Record<string, Record<string, string>>

  constructor(previews: Record<string, Record<string, string>>) {
    this.previews = previews
  }

  toString() {
    return `import { RouterProvider, createBrowserRouter, Outlet, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
${Object.values(this.previews)
  .flatMap(imports => {
    return Object.entries(imports)
      .map(([name, path]) => `import { ${name} } from '${path.replace(/^@\//, '/')}';`)
      .join('\n')
  })
  .join('\n')}

const queryClient = new QueryClient()


export const router = createBrowserRouter([
  ${Object.entries(this.previews ?? {}).flatMap(([group, imports]) => {
    return Object.keys(imports)
      .map(name => {
        return `{
        path: '/${group}/${name}',
        element: <${name} />
      }`
      })
      .join(',\n')
  })}
]);

export const App = () => (
<QueryClientProvider client={queryClient}>
  <RouterProvider router={router} />
</QueryClientProvider>
)
`
  }
}
