import { Dispatch, FC, SetStateAction, useState } from 'react'
import {
  Button,
  ButtonGroup,
  elMb5,
  elMb8,
  elMl8,
  FlexContainer,
  PageHeader,
  StepsVertical,
  Tile,
  useMediaQuery,
} from '@reapit/elements'
import { useForm, UseFormTrigger } from 'react-hook-form'
import { CreateContactModel } from '@reapit/foundations-ts-definitions'
import { yupResolver } from '@hookform/resolvers/yup'
import { NavigateFunction, useNavigate } from 'react-router'
import { CONTACTS_ROUTES } from '../routes'
import { ContactFormSchema, contactsValidationSchema } from '../form/contacts-validation-schema'
import { ContactsPersonal } from '../form/contacts-personal-details'
import { cx } from '@linaria/core'
import { ContactsComsDetails } from '../form/contacts-coms-details'
import { ContactsAddresses } from '../form/contacts-addresses'
import { ContactsOfficeDetails } from '../form/contacts-office-details'
import { UpdateFunction, usePlatformUpdate } from '../../../hooks'
import { ErrorBoundary } from '../../../utils/error-boundary'
import { navigateRoute } from '../../../utils/navigate'

export const handleSwitchStep =
  (
    step: string,
    selectedStep: string,
    trigger: UseFormTrigger<ContactFormSchema>,
    setSelectedStep: Dispatch<SetStateAction<string>>,
  ) =>
  () => {
    const validateStep = async () => {
      let isValid = false

      switch (selectedStep) {
        case '1':
          isValid = await trigger(['title', 'dateOfBirth', 'forename', 'surname'])
          break
        case '2':
          isValid = await trigger([
            'homePhone',
            'workPhone',
            'mobilePhone',
            'email',
            'marketingConsent',
            'communicationPreferenceEmail',
            'communicationPreferencePhone',
            'communicationPreferenceLetter',
            'communicationPreferenceSMS',
          ])
          break
        case '3':
          isValid = await trigger(['primaryAddress', 'secondaryAddress', 'workAddress'])
          break
        case '4':
        default:
          isValid = await trigger(['negotiatorIds', 'categoryIds', 'officeIds', 'source'])
          break
      }
      if (isValid) {
        setSelectedStep(step)
      }
    }
    validateStep()
  }

export const handleSubmitContact =
  (createContact: UpdateFunction<CreateContactModel, boolean>, navigate: NavigateFunction) =>
  async (values: ContactFormSchema) => {
    const { source, categoryIds, negotiatorIds, officeIds } = values

    const createContactParams: CreateContactModel = {
      ...values,
      categoryIds: categoryIds?.split(',').filter(Boolean),
      negotiatorIds: negotiatorIds?.split(',').filter(Boolean),
      officeIds: officeIds?.split(',').filter(Boolean),
      source: {
        id: source?.split('-')[0],
        type: source?.split('-')[1],
      },
    }

    const result = await createContact(createContactParams)

    if (result) {
      navigate(CONTACTS_ROUTES.CONTACTS_LIST)
    }
  }

export const ContactsNew: FC = () => {
  const [selectedStep, setSelectedStep] = useState<string>('1')
  const navigate = useNavigate()
  const { isTablet, isMobile } = useMediaQuery()

  const form = useForm<ContactFormSchema>({
    resolver: yupResolver(contactsValidationSchema),
  })

  const { handleSubmit, trigger } = form

  const [createContact, createContactLoading] = usePlatformUpdate<CreateContactModel, boolean>({
    path: '/contacts',
    successMessage: 'Contact created successfully',
  })

  const nextStep = String(Number(selectedStep) + 1)

  return (
    <ErrorBoundary>
      <PageHeader
        hasMaxWidth
        pageTitle={{
          children: 'New Contact',
          hasBoldText: true,
        }}
        buttons={[
          {
            children: 'Back To List',
            intent: 'default',
            className: elMb5,
            onClick: navigateRoute(navigate, '/contacts/list'),
          },
        ]}
      />
      <FlexContainer isFlexColumn hasMaxWidth>
        <Tile>
          <form>
            <StepsVertical
              steps={[
                {
                  item: '1',
                  content: <ContactsPersonal form={form} />,
                },
                {
                  item: '2',
                  content: <ContactsComsDetails form={form} />,
                },
                {
                  item: '3',
                  content: <ContactsAddresses form={form} />,
                },
                {
                  item: '4',
                  content: <ContactsOfficeDetails form={form} />,
                },
              ]}
              selectedStep={selectedStep}
              onStepClick={setSelectedStep}
            />
            <ButtonGroup className={cx(elMb8, !isTablet && !isMobile && elMl8)} alignment="left">
              {selectedStep === '4' ? (
                <Button
                  intent="primary"
                  onClick={handleSubmit(handleSubmitContact(createContact, navigate))}
                  type="button"
                  disabled={createContactLoading}
                  loading={createContactLoading}
                >
                  Create
                </Button>
              ) : (
                <Button
                  intent="primary"
                  onClick={handleSwitchStep(nextStep, selectedStep, trigger, setSelectedStep)}
                  type="button"
                  disabled={createContactLoading}
                  loading={createContactLoading}
                >
                  Next
                </Button>
              )}
            </ButtonGroup>
          </form>
        </Tile>
      </FlexContainer>
    </ErrorBoundary>
  )
}
