import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routes } from '@/routes.generated'
import '@reapit/elements/dist/index.css'
import { z } from 'zod'
import LoginModule from '@/components/Login/Login'
import { StrictMode } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  Loader,
  MainContainer,
  MediaStateProvider,
  NavStateProvider,
  PageContainer,
  SnackProvider
} from '@reapit/elements'

const router = createBrowserRouter([
  ...routes,
  {
    path: '/login',
    element: <LoginModule />
  },
  {
    path: '*',
    element: (
      <MainContainer hasGreyBackground>
        <PageContainer>
          <Loader fullPage />
        </PageContainer>
      </MainContainer>
    )
  },
  {
    path: '/',
    element: <Navigate to={`/contacts${window.location.search}`} replace />
  }
])

const queryClient = new QueryClient()

z.setErrorMap((issue, ctx) => {
  if (issue.code === z.ZodIssueCode.too_small && issue.type === 'string' && issue.minimum === 1) {
    return { message: 'This field is required' }
  }
  return { message: ctx.defaultError }
})

export const App = () => (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <SnackProvider>
          <NavStateProvider>
            <MediaStateProvider>
              <RouterProvider router={router} />
            </MediaStateProvider>
          </NavStateProvider>
        </SnackProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>
)
