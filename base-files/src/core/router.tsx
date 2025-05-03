import { FC, lazy, Suspense, useEffect, useRef, useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { match } from 'ts-pattern'

type PreviewContent = {
  group: string
  name: string
  url: string
  route: string
}

export const PreviewContainer: FC = () => {
  const [previewContent, setPreviewContent] = useState<PreviewContent | null>(null)
  const { pathname, search } = window.location

  useEffect(() => {
    if (pathname.startsWith('/_preview/')) {
      const [group, name] = pathname.replace(/^\/_preview\//, '').split('/')
      const query = new URLSearchParams(search)

      setPreviewContent({
        group,
        name,
        url: query.get('url') ?? '/',
        route: query.get('route') ?? '/'
      })
    } else {
      setPreviewContent(null)
    }
  }, [pathname, search])

  if (!previewContent) {
    return null
  }

  return (
    <MemoryRouter initialEntries={[previewContent.url]}>
      <Routes>
        <Route
          path={previewContent.route}
          element={<DynamicParent group={previewContent.group} name={previewContent.name} />}
        />
      </Routes>
    </MemoryRouter>
  )
}

type Method = 'get' | 'post' | 'put' | 'delete' | 'options' | 'head' | 'patch' | 'trace'

type MockResponseMap = Record<string, Record<Method, MockResponse>>

type MockResponse = {
  status: number
  body: string
  contentType: string
}

type DynamicParentProps = {
  group: string
  name: string
}

const DynamicParent = ({ group, name }: DynamicParentProps) => {
  const mockResponseMapRef = useRef<MockResponseMap | null>(null)

  useEffect(() => {
    import('../mock-responses.generated.js').then(({ mockResponses: mocks }) => {
      const mockEntries = Object.entries(mocks).map(([url, methods]) => {
        return [`http://localhost:54321/functions/v1${url}`, methods]
      })

      mockResponseMapRef.current = Object.fromEntries(mockEntries)
    })
  }, [])

  useEffect(() => {
    const f = window.fetch

    window.fetch = async (url, options) => {
      const mockResponseMap = mockResponseMapRef.current ?? {}

      try {
        const matchedResponse =
          mockResponseMap[url.toString()][options?.method?.toLowerCase() as Method]

        if (matchedResponse) {
          const { body, status, contentType } = matchedResponse

          if (contentType === 'application/json') {
            return Promise.resolve(
              new Response(JSON.stringify(body), {
                status,
                headers: new Headers({
                  'Content-Type': 'application/json'
                })
              })
            )
          }
        }

        return f(url, options)
      } catch (e) {
        console.error('ERROR', e)
        throw e
      }
    }

    return () => {
      window.fetch = f
    }
  }, [mockResponseMapRef.current])

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
      return () => (
        <div className="flex flex-col gap-4">
          <Suspense fallback={<div>Loading...</div>}>
            <Component />
          </Suspense>
        </div>
      )
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
