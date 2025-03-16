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
  const [group, name] = pathname.replace(/^\/_preview\//, '').split('/')

  return <DynamicContainer key={name} group={group} name={name} />
}

type DynamicContainerProps = {
  group: string
  name: string
}

const DynamicContainer = ({ group, name }: DynamicContainerProps) => {
  console.log('GROUP', group)
  console.log('NAME', name)

  const Component = lazy(async () => {
    return {
      default: (await import(`../${group}/${name}.generated.tsx`))[name]
    }
  })

  return (
    <div className="flex h-screen w-screen">
      <Suspense fallback={<div>Loading...</div>}>
        <Component />
      </Suspense>
    </div>
  )
}
