import { FlexContainer, PageContainer } from '@reapit/elements'
import { ReactNode } from 'react'

type PageProps = {
  children: ReactNode
}

export const Page = ({ children }: PageProps) => (
  <FlexContainer isFlexAuto>
    <PageContainer hasGreyBackground>{children}</PageContainer>
  </FlexContainer>
)
