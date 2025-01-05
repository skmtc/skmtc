import { FC } from 'react'
import { KeyValueList, StatusIndicator } from '@reapit/elements'
import { ContactModel } from '@reapit/foundations-ts-definitions'
import { combineName } from '../../../utils/combine-name'
import { combineAddress } from '../../../utils/combine-address'

export interface ContactQuickViewProps {
  contact: ContactModel
}

export const ContactQuickView: FC<ContactQuickViewProps> = ({ contact }) => {
  const { forename, title, active, surname, homePhone, workPhone, mobilePhone, email, primaryAddress } = contact
  return (
    <KeyValueList
      items={[
        {
          key: 'Name',
          value: combineName(title, forename, surname),
          iconName: 'contact',
        },
        {
          key: 'Email',
          value: email || '-',
          iconName: 'email',
        },
        {
          key: 'Active Status',
          value: (
            <>
              <StatusIndicator intent={active ? 'success' : 'danger'} /> {active ? 'Active' : 'Inactive'}{' '}
            </>
          ),
          iconName: 'info',
        },
        {
          key: 'Mobile',
          value: mobilePhone || '-',
          iconName: 'phone',
        },
        {
          key: 'Home',
          value: homePhone || '-',
          iconName: 'phone',
        },
        {
          key: 'Work',
          value: workPhone || '-',
          iconName: 'phone',
        },
        {
          key: 'Primary Address',
          value: combineAddress(primaryAddress),
          iconName: 'property',
        },
      ]}
    />
  )
}
