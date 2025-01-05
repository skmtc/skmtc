import { FC } from 'react'
import { Navigate, Routes as Router } from 'react-router'
import { Route } from 'react-router-dom'
import { FlexContainer, PageContainer } from '@reapit/elements'

import { ContactsList } from '../list'
import { ContactsNew } from '../new'
import { ContactsEdit } from '../edit'

export const ContactsPage: FC = () => {
  const desktopContactCode = window['__REAPIT_MARKETPLACE_GLOBALS__']?.cntCode

  if (desktopContactCode && !window.location.pathname.includes(desktopContactCode)) {
    window['__REAPIT_MARKETPLACE_GLOBALS__'].cntCode = null
    return <Navigate to={`${desktopContactCode}/view`} replace />
  }

  return (
    <FlexContainer isFlexAuto>
      <PageContainer hasGreyBackground>
        <Router>
          <Route path=":contactId/*" element={<ContactsEdit />} />
          <Route path="list" element={<ContactsList />} />
          <Route path="new" element={<ContactsNew />} />
        </Router>
      </PageContainer>
    </FlexContainer>
  )
}

export default ContactsPage
