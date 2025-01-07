import { FC, PropsWithChildren, Suspense } from 'react'
// import { useReapitConnect } from '@reapit/connect-session'
import { TopNav } from './TopNav'
// import { reapitConnectBrowserSession } from '@/lib/connectSession'
// import { useLocation, redirect } from 'react-router-dom'
import { Loader, MainContainer, PageContainer } from '@reapit/elements'
import { Page } from '@/components/Page'

export const PrivateRouteWrapper: FC<PropsWithChildren> = ({ children }) => {
  // const { connectSession, connectInternalRedirect } = useReapitConnect(reapitConnectBrowserSession)
  // const location = useLocation()

  // if (!connectSession) {
  //   return (
  //     <MainContainer hasGreyBackground>
  //       <PageContainer>
  //         <Loader fullPage />
  //       </PageContainer>
  //     </MainContainer>
  //   )
  // }

  // if (connectInternalRedirect && location?.pathname !== connectInternalRedirect) {
  //   redirect(connectInternalRedirect)
  // }

  return (
    <MainContainer hasGreyBackground>
      <TopNav />
      <Suspense fallback={<Loader fullPage />}>
        <Page>{children}</Page>
      </Suspense>
    </MainContainer>
  )
}
