import { Dispatch, FC, SetStateAction, useEffect, useState } from 'react'
import {
  Button,
  ButtonGroup,
  elMb8,
  elMb7,
  FormLayout,
  InputGroup,
  InputWrap,
  Label,
  Loader,
  Pagination,
  PersistentNotification,
  StatusIndicator,
  Table,
  Tile,
  ToggleRadio,
  useModal,
  useDrawer,
  PageHeader,
  FlexContainer,
  elMb5,
} from '@reapit/elements'
import debounce from 'just-debounce-it'
import { useForm, UseFormWatch } from 'react-hook-form'
import { ContactModel, ContactModelPagedResult, UpdateContactModel } from '@reapit/foundations-ts-definitions'
import { useNavigate } from 'react-router'
import { UpdateFunction, usePlatformGet, usePlatformUpdate } from '../../../hooks'
import { combineAddress } from '../../../utils/combine-address'
import { combineName } from '../../../utils/combine-name'
import { ErrorBoundary } from '../../../utils/error-boundary'
import { navigateRoute } from '../../../utils/navigate'
import { ContactQuickView } from './contact-quick-view'

export type ContactFilterValues = {
  name?: string
  address?: string
  email?: string
  active?: string
}

export const handleOpenModal =
  (
    openModal: () => void,
    contact: ContactModel,
    setContactToToggleActive: Dispatch<SetStateAction<ContactModel | null>>,
  ) =>
  () => {
    openModal()
    setContactToToggleActive(contact)
  }

export const handleOpenDrawer =
  (
    openDrawer: () => void,
    contact: ContactModel,
    setContactToQuickView: Dispatch<SetStateAction<ContactModel | null>>,
  ) =>
  () => {
    openDrawer()
    setContactToQuickView(contact)
  }

export const handleToggleActiveContact =
  (
    closeModal: () => void,
    contactsRefresh: () => void,
    toggleActiveContact: UpdateFunction<UpdateContactModel, boolean>,
    setContactToToggleActive: Dispatch<SetStateAction<ContactModel | null>>,
    active?: boolean,
  ) =>
  async () => {
    const deleted = await toggleActiveContact({ active: !active })

    if (deleted) {
      closeModal()
      contactsRefresh()
      setContactToToggleActive(null)
    }
  }

export const handleSetContactsFilters =
  (setContactFilters: Dispatch<SetStateAction<ContactFilterValues>>, watch: UseFormWatch<ContactFilterValues>) =>
  () => {
    const subscription = watch(debounce(setContactFilters, 500))
    return () => subscription.unsubscribe()
  }

export const ContactsList: FC = () => {
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [contactToToggleActive, setContactToToggleActive] = useState<ContactModel | null>(null)
  const [contactToQuickView, setContactToQuickView] = useState<ContactModel | null>(null)
  const [contactFilters, setContactFilters] = useState<ContactFilterValues>({})
  const navigate = useNavigate()
  const { Modal, openModal, closeModal } = useModal()
  const [Drawer, openDrawer, closeDrawer] = useDrawer()

  const { register, watch } = useForm<ContactFilterValues>({
    mode: 'onChange',
  })

  useEffect(handleSetContactsFilters(setContactFilters, watch), [])

  const [contacts, contactsLoading, , contactsRefresh] = usePlatformGet<ContactModelPagedResult>({
    path: '/contacts',
    queryParams: {
      ...contactFilters,
      pageNumber,
      pageSize: 12,
    },
  })

  const [toggleActiveContact, toggleActiveContactLoading] = usePlatformUpdate<UpdateContactModel, boolean>({
    path: `/contacts/${contactToToggleActive?.id}`,
    method: 'PATCH',
    headers: {
      'if-match': contactToToggleActive?._eTag ?? '',
    },
    successMessage: `Contact successfully ${contactToToggleActive?.active ? 'deactivated' : 'activated'}`,
  })

  return (
    <ErrorBoundary>
      <PageHeader
        hasMaxWidth
        pageTitle={{
          children: 'Contacts',
          hasBoldText: true,
        }}
        buttons={[
          {
            children: 'New Contact',
            intent: 'primary',
            className: elMb5,
            onClick: navigateRoute(navigate, '/contacts/new'),
          },
        ]}
      />
      <FlexContainer hasMaxWidth isFlexColumn>
        <Tile>
          <form>
            <FormLayout className={elMb8}>
              <InputWrap>
                <InputGroup
                  {...register('name')}
                  label="Contact Name"
                  type="search"
                  icon="search"
                  placeholder="Search name"
                />
              </InputWrap>
              <InputWrap>
                <InputGroup
                  {...register('address')}
                  label="Contact Address"
                  type="search"
                  icon="search"
                  placeholder="Search address"
                />
              </InputWrap>
              <InputWrap>
                <InputGroup
                  {...register('email')}
                  label="Contact Email"
                  type="search"
                  icon="search"
                  placeholder="Search email"
                />
              </InputWrap>
              <InputWrap>
                <InputGroup>
                  <Label>Active Contacts</Label>
                  <ToggleRadio
                    {...register('active')}
                    hasGreyBg
                    options={[
                      {
                        id: 'option-active-all',
                        value: '',
                        text: 'All',
                        isChecked: true,
                      },
                      {
                        id: 'option-active-true',
                        value: 'true',
                        text: 'Active',
                        isChecked: false,
                      },
                      {
                        id: 'option-active-false',
                        value: 'false',
                        text: 'Inactive',
                        isChecked: false,
                      },
                    ]}
                  />
                </InputGroup>
              </InputWrap>
            </FormLayout>
          </form>
          {contactsLoading && <Loader />}
          {contacts?._embedded?.length ? (
            <>
              <Table
                className={elMb8}
                rows={contacts._embedded.map((contact) => {
                  const { id, title, forename, surname, email, primaryAddress, mobilePhone, active } = contact
                  return {
                    cells: [
                      {
                        label: 'Contact Name',
                        value: combineName(title, forename, surname),
                        icon: 'contact',
                        cellHasDarkText: true,
                        narrowTable: {
                          showLabel: true,
                        },
                      },
                      {
                        label: 'Contact Email',
                        icon: 'email',
                        value: email ?? '-',
                        narrowTable: {
                          showLabel: true,
                        },
                      },
                      {
                        label: 'Contact Mobile Phone',
                        icon: 'phone',
                        value: mobilePhone ?? '-',
                        narrowTable: {
                          showLabel: true,
                        },
                      },
                      {
                        label: 'Contact Address',
                        icon: 'property',
                        value: combineAddress(primaryAddress),
                        narrowTable: {
                          showLabel: true,
                        },
                      },
                      {
                        label: 'Contact Active',
                        value: (
                          <>
                            <StatusIndicator intent={active ? 'success' : 'danger'} /> {active ? 'Active' : 'Inactive'}
                          </>
                        ),
                        narrowTable: {
                          showLabel: true,
                        },
                      },
                    ],
                    expandableContent: {
                      content: (
                        <>
                          <ButtonGroup alignment="center">
                            <Button
                              onClick={handleOpenDrawer(openDrawer, contact, setContactToQuickView)}
                              intent="default"
                            >
                              Quick View Contact
                            </Button>
                            <Button onClick={navigateRoute(navigate, `/contacts/${id}/view`)} intent="default">
                              Full Contact
                            </Button>
                            <Button onClick={navigateRoute(navigate, `/contacts/${id}/personal`)} intent="primary">
                              Edit Contact
                            </Button>
                            <Button
                              onClick={handleOpenModal(openModal, contact, setContactToToggleActive)}
                              intent={active ? 'danger' : 'primary'}
                            >
                              {active ? 'Deactivate' : 'Activate'}
                            </Button>
                          </ButtonGroup>
                        </>
                      ),
                    },
                  }
                })}
              />
              <div className={elMb8}>
                <Pagination
                  callback={setPageNumber}
                  currentPage={pageNumber}
                  numberPages={Math.ceil((contacts?.totalCount ?? 1) / 12)}
                />
              </div>
              <Modal title="Deactivate Contact">
                <PersistentNotification
                  className={elMb7}
                  isExpanded
                  isFullWidth
                  isInline
                  intent={contactToToggleActive?.active ? 'danger' : 'primary'}
                >
                  Are you sure you want to {contactToToggleActive?.active ? 'deactivate' : 'activate'} this contact?
                </PersistentNotification>
                <ButtonGroup alignment="center">
                  <Button onClick={closeModal} intent="default">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleToggleActiveContact(
                      closeModal,
                      contactsRefresh,
                      toggleActiveContact,
                      setContactToToggleActive,
                      contactToToggleActive?.active,
                    )}
                    disabled={toggleActiveContactLoading}
                    intent={contactToToggleActive?.active ? 'danger' : 'primary'}
                  >
                    {contactToToggleActive?.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </ButtonGroup>
              </Modal>
              {contactToQuickView && (
                <Drawer
                  title="Quick View"
                  canDismiss
                  footerItems={
                    <ButtonGroup alignment="right">
                      <Button onClick={closeDrawer}>Close</Button>
                    </ButtonGroup>
                  }
                >
                  <ContactQuickView contact={contactToQuickView} />
                </Drawer>
              )}
            </>
          ) : !contactsLoading && contacts && !contacts._embedded?.length ? (
            <PersistentNotification className={elMb8} isInline isExpanded isFullWidth intent="primary">
              No contacts found for your search terms, please try again.
            </PersistentNotification>
          ) : null}
        </Tile>
      </FlexContainer>
    </ErrorBoundary>
  )
}
