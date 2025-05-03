import { FC, StrictMode } from 'react'
import { PreviewContainer } from '@/core/router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

const App: FC = () => (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PreviewContainer />
    </QueryClientProvider>
  </StrictMode>
)

export default App
