import { FC, PropsWithChildren, Suspense } from 'react'
import { useReapitConnect } from '@reapit/connect-session'
import { Nav } from './nav'
import { reapitConnectBrowserSession } from './connect-session'
import { useLocation, redirect } from 'react-router'
import { Loader, MainContainer, PageContainer } from '@reapit/elements'

export const PrivateRouteWrapper: FC<PropsWithChildren> = ({ children }) => {
  const { connectSession, connectInternalRedirect } = useReapitConnect(reapitConnectBrowserSession)
  const location = useLocation()

  if (!connectSession) {
    return (
      <MainContainer hasGreyBackground>
        <PageContainer>
          <Loader fullPage />
        </PageContainer>
      </MainContainer>
    )
  }

  if (connectInternalRedirect && location?.pathname !== connectInternalRedirect) {
    redirect(connectInternalRedirect)
  }

  return (
    <MainContainer hasGreyBackground>
      <Nav />
      <Suspense fallback={<Loader fullPage />}>{children}</Suspense>
    </MainContainer>
  )
}

export default PrivateRouteWrapper
