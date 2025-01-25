/** See: https://testing-library.com/docs/react-testing-library/setup#custom-render
 * Renders a React Component with  UI providers as a testing convenience
 */
import { FC, PropsWithChildren, ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MediaStateProvider, NavStateProvider, SnackProvider } from '@reapit/elements'

const queryClient = new QueryClient()

export const CombinedProvider: FC<PropsWithChildren> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <SnackProvider>
        <MediaStateProvider>
          <NavStateProvider>
            <MemoryRouter>
              <Routes>
                <Route path="/" element={<>{children}</>} />
              </Routes>
            </MemoryRouter>
          </NavStateProvider>
        </MediaStateProvider>
      </SnackProvider>
    </QueryClientProvider>
  )
}

const customRender = (ui: ReactElement, options?: RenderOptions<any, HTMLElement>) =>
  render(<CombinedProvider>{ui}</CombinedProvider>, { ...options })

// re-export everything
export * from '@testing-library/react'

// override render method
export { customRender as render }
