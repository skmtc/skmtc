import { FC } from 'react'
import { FlexContainer, PageContainer } from '@reapit/elements'
import { Routes as Router } from 'react-router'
import { Route } from 'react-router-dom'
import Wrapper from './wrapper'

export const NewPage: FC = () => {
  return (
    <FlexContainer isFlexAuto>
      <PageContainer hasGreyBackground>
        <Router>
          <Route path="home" element={<Wrapper />} />
        </Router>
      </PageContainer>
    </FlexContainer>
  )
}

export default NewPage
