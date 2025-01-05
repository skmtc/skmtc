import '@reapit/elements/dist/index.css'
import { FC, StrictMode } from 'react'
import { Router } from './router'
import { MediaStateProvider, NavStateProvider, SnackProvider } from '@reapit/elements'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ErrorBoundary } from '../utils/error-boundary'

const queryClient = new QueryClient()

const App: FC = () => (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <SnackProvider>
          <NavStateProvider>
            <MediaStateProvider>
              <Router />
            </MediaStateProvider>
          </NavStateProvider>
        </SnackProvider>
      </ErrorBoundary>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>
)

export default App
