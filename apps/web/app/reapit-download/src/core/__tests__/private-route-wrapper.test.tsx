import { render } from '@testing-library/react'
import { useReapitConnect } from '@reapit/connect-session'
import { MediaStateProvider, NavStateProvider, SnackProvider } from '@reapit/elements'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, redirect, Route, Routes } from 'react-router'
import { PrivateRouteWrapper } from '../private-route-wrapper'

jest.mock('../connect-session')
jest.mock('@reapit/connect-session', () => ({
  ReapitConnectBrowserSession: jest.fn(),
  useReapitConnect: jest.fn(() => ({
    connectSession: {
      loginIdentity: {
        name: 'MOCK_NAME',
      },
    },
    connectInternalRedirect: '',
  })),
}))
jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  redirect: jest.fn(),
}))

const mockUseReapitConnect = useReapitConnect as jest.Mock
const queryClient = new QueryClient()

const createWrapper = (children) => {
  return (
    <QueryClientProvider client={queryClient}>
      <SnackProvider>
        <MediaStateProvider>
          <NavStateProvider>
            <MemoryRouter>
              <Routes>
                <Route path="/" element={children} />
              </Routes>
            </MemoryRouter>
          </NavStateProvider>
        </MediaStateProvider>
      </SnackProvider>
    </QueryClientProvider>
  )
}

describe('PrivateRouteWrapper', () => {
  it('should match a snapshot', () => {
    expect(
      render(
        createWrapper(
          <PrivateRouteWrapper>
            <div />
          </PrivateRouteWrapper>,
        ),
      ),
    ).toMatchSnapshot()
  })

  it('should match a snapshot where there is no session', () => {
    mockUseReapitConnect.mockReturnValueOnce({})
    expect(
      render(
        createWrapper(
          <PrivateRouteWrapper>
            <div />
          </PrivateRouteWrapper>,
        ),
      ),
    ).toMatchSnapshot()
  })

  it('should redirect if required', () => {
    mockUseReapitConnect.mockReturnValueOnce({
      connectInternalRedirect: '/foo',
      connectSession: {
        loginIdentity: {},
      },
    })

    render(
      createWrapper(
        <PrivateRouteWrapper>
          <div />
        </PrivateRouteWrapper>,
      ),
    )

    expect(redirect).toHaveBeenCalledWith('/foo')
  })
})
