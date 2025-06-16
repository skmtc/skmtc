import { FC } from 'react'
import { PreviewContainer } from '@/core/router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

const App: FC = () => (
  <QueryClientProvider client={queryClient}>
    <PreviewContainer />
  </QueryClientProvider>
)

export default App
