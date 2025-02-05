import { routes } from '@/core/routes.generated'
import { useLocation } from 'react-router-dom'
import { Suspense } from 'react'
import { TopNav } from '@/core/top-nav'
import { Loader, MainContainer } from '@reapit/elements'
import { Page } from '@/components/Page'

export const PreviewContainer = () => {
  const { pathname } = useLocation()

  return (
    <MainContainer hasGreyBackground>
      <TopNav />
      <Suspense fallback={<Loader fullPage />}>
        <Page>
          <div className="flex h-screen w-screen">
            {routes.find(({ name }) => `/_preview/${name}` === pathname)?.element ?? 'Not found'}
          </div>
        </Page>
      </Suspense>
    </MainContainer>
  )
}
