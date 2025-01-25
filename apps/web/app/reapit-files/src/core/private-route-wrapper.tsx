import { FC, PropsWithChildren, Suspense } from 'react'
import { TopNav } from './top-nav'
import { Loader, MainContainer } from '@reapit/elements'
import { Page } from '@/components/Page'

export const PrivateRouteWrapper: FC<PropsWithChildren> = ({ children }) => {
  return (
    <MainContainer hasGreyBackground>
      <TopNav />
      <Suspense fallback={<Loader fullPage />}>
        <Page>{children}</Page>
      </Suspense>
    </MainContainer>
  )
}
