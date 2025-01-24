import { elMb5, PageHeader } from '@reapit/elements'
import { useNavigate } from 'react-router-dom'
import { navigateRoute } from '@/utils/navigate'
import { CreateWorkflow } from '@/components/CreateWorkflow'
import { CreateContactsForm } from '@/sections/Contacts/forms/CreateContactsForm.generated'
import { createContactsConfig } from '@/sections/Contacts/config/createContactsConfig.example'

const CreateContactsWorkflowHeader = () => {
  const navigate = useNavigate()

  return (
    <PageHeader
      hasMaxWidth
      pageTitle={{
        children: 'New Contact',
        hasBoldText: true
      }}
      buttons={[
        {
          children: 'Back To List',
          intent: 'default',
          className: elMb5,
          onClick: navigateRoute(navigate, '/contacts')
        }
      ]}
    />
  )
}

export const CreateContacts = () => (
  <CreateWorkflow
    fieldConfig={createContactsConfig}
    FormContainer={CreateContactsForm}
    sections={[
      {
        title: 'Provide us with some basic personal information about your contact.',
        fields: ['title', 'dateOfBirth', 'forename', 'surname']
      },
      {
        title: 'Provide here the communication details and marketing preferences of your contact.',
        fields: [
          'homePhone',
          'workPhone',
          'mobilePhone',
          'email',
          'communicationPreferenceEmail',
          'communicationPreferencePhone',
          'communicationPreferenceLetter',
          'communicationPreferenceSMS',
          'marketingConsent'
        ]
      },
      {
        title: 'Provide information here relating to your Reapit organisation & office.',
        fields: ['negotiatorIds', 'officeIds']
      }
    ]}
  >
    <CreateContactsWorkflowHeader />
  </CreateWorkflow>
)
