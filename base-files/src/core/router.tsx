import { FC, lazy, Suspense } from 'react'
import { Route, BrowserRouter, Routes, useLocation } from 'react-router'
import { routes } from './routes.generated.tsx'

export const RoutesComponent: FC = () => {
  return (
    <Routes>
      {routes.map(({ path, element }) => (
        <Route key={path} path={path} element={element} />
      ))}

      <Route path="/_preview/*" element={<DynamicParent />} />
    </Routes>
  )
}

export const Router: FC = () => (
  <BrowserRouter>
    <RoutesComponent />
  </BrowserRouter>
)

const DynamicParent = () => {
  const { pathname } = useLocation()
  const name = pathname.replace(/^\/_preview\//, '')

  return <DynamicContainer key={name} name={name} />
}

type DynamicContainerProps = {
  name: string
}

const DynamicContainer = ({ name }: DynamicContainerProps) => {
  const Component = lazy(async () => {
    return {
      default: (await import(`../forms/${name}.generated.tsx`))[name]
    }
  })

  return (
    <div className="flex h-screen w-screen">
      <Suspense fallback={<div>Loading...</div>}>
        <Component title="Hello">
          <button>Click me</button>
        </Component>
      </Suspense>
    </div>
  )
}
