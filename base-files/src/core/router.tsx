import { FC, lazy, Suspense } from 'react'
import { Route, BrowserRouter, Routes, useLocation } from 'react-router'
import { match } from 'ts-pattern'
import { useForm, FormProvider } from 'react-hook-form'

export const RoutesComponent: FC = () => {
  // @TODO: Remove react-router and use exported app directly
  // or load components dynamically if path starts with /_preview/
  return (
    <Routes>
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
  const Component = lazy(async () => {
    return {
      default: (await import(`../${group}/${name}.generated.tsx`))[name]
    }
  })

  const Container = toDynamicContainer({ group, name, Component })

  return (
    <div className="flex h-screen w-screen">
      <Container />
    </div>
  )
}

type ToDynamicContainerArgs = {
  group: string
  name: string
  Component: React.ComponentType
}

const toDynamicContainer = ({ group, name, Component }: ToDynamicContainerArgs) => {
  return match(group)
    .returnType<React.ComponentType>()
    .with('forms', () => {
      return () => (
        <div className="flex flex-col gap-4">
          <Suspense fallback={<div>Loading...</div>}>
            <Component />
          </Suspense>
        </div>
      )
    })
    .with('tables', () => {
      return () => (
        <div className="flex flex-col gap-4">
          <Suspense fallback={<div>Loading...</div>}>
            <Component />
          </Suspense>
        </div>
      )
    })
    .with('inputs', () => {
      return () => {
        const form = useForm({
          defaultValues: {
            test: ''
          }
        })

        return (
          <FormProvider {...form}>
            <div className="flex flex-col gap-4">
              <Suspense fallback={<div>Loading...</div>}>
                <Component fieldName="test" label="Test" />
              </Suspense>
            </div>
          </FormProvider>
        )
      }
    })
    .otherwise(() => {
      return () => (
        <div className="flex flex-col gap-4">
          <h1>
            Unknown group: {group} / {name}
          </h1>
        </div>
      )
    })
}
