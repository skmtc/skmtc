import { SecondaryNav, SecondaryNavContainer, SecondaryNavItem } from '@reapit/elements'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

export const Navigation = () => {
  const navigate = useNavigate()
  const [selectedItem, setSelectedItem] = useState<string>()

  return (
    <SecondaryNavContainer>
      <SecondaryNav>
        <SecondaryNavItem
          active={selectedItem === '/applicants/'}
          onClick={() => {
            navigate('/applicants/')
            setSelectedItem('/applicants/')
          }}
        >
          Get Applicants
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/applicants/new'}
          onClick={() => {
            navigate('/applicants/new')
            setSelectedItem('/applicants/new')
          }}
        >
          Create Applicants
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/applicants/:id/relationships'}
          onClick={() => {
            navigate('/applicants/:id/relationships')
            setSelectedItem('/applicants/:id/relationships')
          }}
        >
          Get ApplicantsIdRelationships
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/applicants/:id/relationshipsnew'}
          onClick={() => {
            navigate('/applicants/:id/relationshipsnew')
            setSelectedItem('/applicants/:id/relationshipsnew')
          }}
        >
          Create ApplicantsIdRelationships
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/areas/'}
          onClick={() => {
            navigate('/areas/')
            setSelectedItem('/areas/')
          }}
        >
          Get Areas
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/areas/new'}
          onClick={() => {
            navigate('/areas/new')
            setSelectedItem('/areas/new')
          }}
        >
          Create Areas
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/appointments/'}
          onClick={() => {
            navigate('/appointments/')
            setSelectedItem('/appointments/')
          }}
        >
          Get Appointments
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/appointments/new'}
          onClick={() => {
            navigate('/appointments/new')
            setSelectedItem('/appointments/new')
          }}
        >
          Create Appointments
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/appointments/:id/openHouseAttendees'}
          onClick={() => {
            navigate('/appointments/:id/openHouseAttendees')
            setSelectedItem('/appointments/:id/openHouseAttendees')
          }}
        >
          Get AppointmentsIdOpenHouseAttendees
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/appointments/:id/openHouseAttendeesnew'}
          onClick={() => {
            navigate('/appointments/:id/openHouseAttendeesnew')
            setSelectedItem('/appointments/:id/openHouseAttendeesnew')
          }}
        >
          Create AppointmentsIdOpenHouseAttendees
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/companies/'}
          onClick={() => {
            navigate('/companies/')
            setSelectedItem('/companies/')
          }}
        >
          Get Companies
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/companies/new'}
          onClick={() => {
            navigate('/companies/new')
            setSelectedItem('/companies/new')
          }}
        >
          Create Companies
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/companies/:id/relationships'}
          onClick={() => {
            navigate('/companies/:id/relationships')
            setSelectedItem('/companies/:id/relationships')
          }}
        >
          Get CompaniesIdRelationships
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/contacts/'}
          onClick={() => {
            navigate('/contacts/')
            setSelectedItem('/contacts/')
          }}
        >
          Get Contacts
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/contacts/new'}
          onClick={() => {
            navigate('/contacts/new')
            setSelectedItem('/contacts/new')
          }}
        >
          Create Contacts
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/contacts/:id/relationships'}
          onClick={() => {
            navigate('/contacts/:id/relationships')
            setSelectedItem('/contacts/:id/relationships')
          }}
        >
          Get ContactsIdRelationships
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/contacts/:id/subscriptions'}
          onClick={() => {
            navigate('/contacts/:id/subscriptions')
            setSelectedItem('/contacts/:id/subscriptions')
          }}
        >
          Get ContactsIdSubscriptions
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/conveyancing/'}
          onClick={() => {
            navigate('/conveyancing/')
            setSelectedItem('/conveyancing/')
          }}
        >
          Get Conveyancing
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/conveyancing/:id/chain'}
          onClick={() => {
            navigate('/conveyancing/:id/chain')
            setSelectedItem('/conveyancing/:id/chain')
          }}
        >
          Get ConveyancingIdChain
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/conveyancing/:id/downwardnew'}
          onClick={() => {
            navigate('/conveyancing/:id/downwardnew')
            setSelectedItem('/conveyancing/:id/downwardnew')
          }}
        >
          Create ConveyancingIdDownward
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/conveyancing/:id/upwardnew'}
          onClick={() => {
            navigate('/conveyancing/:id/upwardnew')
            setSelectedItem('/conveyancing/:id/upwardnew')
          }}
        >
          Create ConveyancingIdUpward
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/departments/'}
          onClick={() => {
            navigate('/departments/')
            setSelectedItem('/departments/')
          }}
        >
          Get Departments
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/documents/'}
          onClick={() => {
            navigate('/documents/')
            setSelectedItem('/documents/')
          }}
        >
          Get Documents
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/documents/new'}
          onClick={() => {
            navigate('/documents/new')
            setSelectedItem('/documents/new')
          }}
        >
          Create Documents
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/documents/signedUrlnew'}
          onClick={() => {
            navigate('/documents/signedUrlnew')
            setSelectedItem('/documents/signedUrlnew')
          }}
        >
          Create DocumentsSignedUrl
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/enquiries/'}
          onClick={() => {
            navigate('/enquiries/')
            setSelectedItem('/enquiries/')
          }}
        >
          Get Enquiries
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/enquiries/new'}
          onClick={() => {
            navigate('/enquiries/new')
            setSelectedItem('/enquiries/new')
          }}
        >
          Create Enquiries
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/identityChecks/'}
          onClick={() => {
            navigate('/identityChecks/')
            setSelectedItem('/identityChecks/')
          }}
        >
          Get IdentityChecks
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/identityChecks/new'}
          onClick={() => {
            navigate('/identityChecks/new')
            setSelectedItem('/identityChecks/new')
          }}
        >
          Create IdentityChecks
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/identityChecks/signedUrlnew'}
          onClick={() => {
            navigate('/identityChecks/signedUrlnew')
            setSelectedItem('/identityChecks/signedUrlnew')
          }}
        >
          Create IdentityChecksSignedUrl
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/invoices/'}
          onClick={() => {
            navigate('/invoices/')
            setSelectedItem('/invoices/')
          }}
        >
          Get Invoices
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/invoices/payments'}
          onClick={() => {
            navigate('/invoices/payments')
            setSelectedItem('/invoices/payments')
          }}
        >
          Get InvoicesPayments
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/invoices/credits'}
          onClick={() => {
            navigate('/invoices/credits')
            setSelectedItem('/invoices/credits')
          }}
        >
          Get InvoicesCredits
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/invoices/charges'}
          onClick={() => {
            navigate('/invoices/charges')
            setSelectedItem('/invoices/charges')
          }}
        >
          Get InvoicesCharges
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/journalEntries/'}
          onClick={() => {
            navigate('/journalEntries/')
            setSelectedItem('/journalEntries/')
          }}
        >
          Get JournalEntries
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/journalEntries/new'}
          onClick={() => {
            navigate('/journalEntries/new')
            setSelectedItem('/journalEntries/new')
          }}
        >
          Create JournalEntries
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/journalEntries/landlords'}
          onClick={() => {
            navigate('/journalEntries/landlords')
            setSelectedItem('/journalEntries/landlords')
          }}
        >
          Get JournalEntriesLandlords
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/journalEntries/bulknew'}
          onClick={() => {
            navigate('/journalEntries/bulknew')
            setSelectedItem('/journalEntries/bulknew')
          }}
        >
          Create JournalEntriesBulk
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/landlords/'}
          onClick={() => {
            navigate('/landlords/')
            setSelectedItem('/landlords/')
          }}
        >
          Get Landlords
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/landlords/new'}
          onClick={() => {
            navigate('/landlords/new')
            setSelectedItem('/landlords/new')
          }}
        >
          Create Landlords
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/landlords/:id/relationships'}
          onClick={() => {
            navigate('/landlords/:id/relationships')
            setSelectedItem('/landlords/:id/relationships')
          }}
        >
          Get LandlordsIdRelationships
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/landlords/:id/relationshipsnew'}
          onClick={() => {
            navigate('/landlords/:id/relationshipsnew')
            setSelectedItem('/landlords/:id/relationshipsnew')
          }}
        >
          Create LandlordsIdRelationships
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/metadata/'}
          onClick={() => {
            navigate('/metadata/')
            setSelectedItem('/metadata/')
          }}
        >
          Get Metadata
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/metadata/new'}
          onClick={() => {
            navigate('/metadata/new')
            setSelectedItem('/metadata/new')
          }}
        >
          Create Metadata
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/metadata/metadataSchema'}
          onClick={() => {
            navigate('/metadata/metadataSchema')
            setSelectedItem('/metadata/metadataSchema')
          }}
        >
          Get MetadataMetadataSchema
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/metadata/metadataSchemanew'}
          onClick={() => {
            navigate('/metadata/metadataSchemanew')
            setSelectedItem('/metadata/metadataSchemanew')
          }}
        >
          Create MetadataMetadataSchema
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/negotiators/'}
          onClick={() => {
            navigate('/negotiators/')
            setSelectedItem('/negotiators/')
          }}
        >
          Get Negotiators
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/negotiators/new'}
          onClick={() => {
            navigate('/negotiators/new')
            setSelectedItem('/negotiators/new')
          }}
        >
          Create Negotiators
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/notifications/new'}
          onClick={() => {
            navigate('/notifications/new')
            setSelectedItem('/notifications/new')
          }}
        >
          Create Notifications
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/offers/'}
          onClick={() => {
            navigate('/offers/')
            setSelectedItem('/offers/')
          }}
        >
          Get Offers
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/offers/new'}
          onClick={() => {
            navigate('/offers/new')
            setSelectedItem('/offers/new')
          }}
        >
          Create Offers
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/offices/'}
          onClick={() => {
            navigate('/offices/')
            setSelectedItem('/offices/')
          }}
        >
          Get Offices
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/offices/new'}
          onClick={() => {
            navigate('/offices/new')
            setSelectedItem('/offices/new')
          }}
        >
          Create Offices
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/properties/'}
          onClick={() => {
            navigate('/properties/')
            setSelectedItem('/properties/')
          }}
        >
          Get Properties
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/properties/new'}
          onClick={() => {
            navigate('/properties/new')
            setSelectedItem('/properties/new')
          }}
        >
          Create Properties
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/properties/:id/certificates'}
          onClick={() => {
            navigate('/properties/:id/certificates')
            setSelectedItem('/properties/:id/certificates')
          }}
        >
          Get PropertiesIdCertificates
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/properties/:id/certificatesnew'}
          onClick={() => {
            navigate('/properties/:id/certificatesnew')
            setSelectedItem('/properties/:id/certificatesnew')
          }}
        >
          Create PropertiesIdCertificates
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/properties/:id/keys'}
          onClick={() => {
            navigate('/properties/:id/keys')
            setSelectedItem('/properties/:id/keys')
          }}
        >
          Get PropertiesIdKeys
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/properties/:id/keysnew'}
          onClick={() => {
            navigate('/properties/:id/keysnew')
            setSelectedItem('/properties/:id/keysnew')
          }}
        >
          Create PropertiesIdKeys
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/properties/:id/keys/:keyId/movements'}
          onClick={() => {
            navigate('/properties/:id/keys/:keyId/movements')
            setSelectedItem('/properties/:id/keys/:keyId/movements')
          }}
        >
          Get PropertiesIdKeysKeyIdMovements
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/properties/:id/keys/:keyId/movementsnew'}
          onClick={() => {
            navigate('/properties/:id/keys/:keyId/movementsnew')
            setSelectedItem('/properties/:id/keys/:keyId/movementsnew')
          }}
        >
          Create PropertiesIdKeysKeyIdMovements
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/properties/:id/checks'}
          onClick={() => {
            navigate('/properties/:id/checks')
            setSelectedItem('/properties/:id/checks')
          }}
        >
          Get PropertiesIdChecks
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/properties/:id/checksnew'}
          onClick={() => {
            navigate('/properties/:id/checksnew')
            setSelectedItem('/properties/:id/checksnew')
          }}
        >
          Create PropertiesIdChecks
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/properties/certificates'}
          onClick={() => {
            navigate('/properties/certificates')
            setSelectedItem('/properties/certificates')
          }}
        >
          Get PropertiesCertificates
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/properties/:id/appraisals'}
          onClick={() => {
            navigate('/properties/:id/appraisals')
            setSelectedItem('/properties/:id/appraisals')
          }}
        >
          Get PropertiesIdAppraisals
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/properties/:id/appraisalsnew'}
          onClick={() => {
            navigate('/properties/:id/appraisalsnew')
            setSelectedItem('/properties/:id/appraisalsnew')
          }}
        >
          Create PropertiesIdAppraisals
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/propertyImages/'}
          onClick={() => {
            navigate('/propertyImages/')
            setSelectedItem('/propertyImages/')
          }}
        >
          Get PropertyImages
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/propertyImages/new'}
          onClick={() => {
            navigate('/propertyImages/new')
            setSelectedItem('/propertyImages/new')
          }}
        >
          Create PropertyImages
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/propertyImages/signedUrlnew'}
          onClick={() => {
            navigate('/propertyImages/signedUrlnew')
            setSelectedItem('/propertyImages/signedUrlnew')
          }}
        >
          Create PropertyImagesSignedUrl
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/propertyImages/reindexnew'}
          onClick={() => {
            navigate('/propertyImages/reindexnew')
            setSelectedItem('/propertyImages/reindexnew')
          }}
        >
          Create PropertyImagesReindex
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/referrals/'}
          onClick={() => {
            navigate('/referrals/')
            setSelectedItem('/referrals/')
          }}
        >
          Get Referrals
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/referrals/new'}
          onClick={() => {
            navigate('/referrals/new')
            setSelectedItem('/referrals/new')
          }}
        >
          Create Referrals
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/referrals/types'}
          onClick={() => {
            navigate('/referrals/types')
            setSelectedItem('/referrals/types')
          }}
        >
          Get ReferralsTypes
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/resthooks/'}
          onClick={() => {
            navigate('/resthooks/')
            setSelectedItem('/resthooks/')
          }}
        >
          Get Resthooks
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/resthooks/new'}
          onClick={() => {
            navigate('/resthooks/new')
            setSelectedItem('/resthooks/new')
          }}
        >
          Create Resthooks
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/sources/'}
          onClick={() => {
            navigate('/sources/')
            setSelectedItem('/sources/')
          }}
        >
          Get Sources
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/sources/new'}
          onClick={() => {
            navigate('/sources/new')
            setSelectedItem('/sources/new')
          }}
        >
          Create Sources
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tasks/'}
          onClick={() => {
            navigate('/tasks/')
            setSelectedItem('/tasks/')
          }}
        >
          Get Tasks
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tasks/new'}
          onClick={() => {
            navigate('/tasks/new')
            setSelectedItem('/tasks/new')
          }}
        >
          Create Tasks
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/'}
          onClick={() => {
            navigate('/tenancies/')
            setSelectedItem('/tenancies/')
          }}
        >
          Get Tenancies
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/new'}
          onClick={() => {
            navigate('/tenancies/new')
            setSelectedItem('/tenancies/new')
          }}
        >
          Create Tenancies
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/relationships'}
          onClick={() => {
            navigate('/tenancies/:id/relationships')
            setSelectedItem('/tenancies/:id/relationships')
          }}
        >
          Get TenanciesIdRelationships
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/checks'}
          onClick={() => {
            navigate('/tenancies/:id/checks')
            setSelectedItem('/tenancies/:id/checks')
          }}
        >
          Get TenanciesIdChecks
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/checksnew'}
          onClick={() => {
            navigate('/tenancies/:id/checksnew')
            setSelectedItem('/tenancies/:id/checksnew')
          }}
        >
          Create TenanciesIdChecks
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/breakClauses'}
          onClick={() => {
            navigate('/tenancies/:id/breakClauses')
            setSelectedItem('/tenancies/:id/breakClauses')
          }}
        >
          Get TenanciesIdBreakClauses
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/breakClausesnew'}
          onClick={() => {
            navigate('/tenancies/:id/breakClausesnew')
            setSelectedItem('/tenancies/:id/breakClausesnew')
          }}
        >
          Create TenanciesIdBreakClauses
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/allowances'}
          onClick={() => {
            navigate('/tenancies/:id/allowances')
            setSelectedItem('/tenancies/:id/allowances')
          }}
        >
          Get TenanciesIdAllowances
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/allowancesnew'}
          onClick={() => {
            navigate('/tenancies/:id/allowancesnew')
            setSelectedItem('/tenancies/:id/allowancesnew')
          }}
        >
          Create TenanciesIdAllowances
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/responsibilities'}
          onClick={() => {
            navigate('/tenancies/:id/responsibilities')
            setSelectedItem('/tenancies/:id/responsibilities')
          }}
        >
          Get TenanciesIdResponsibilities
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/responsibilitiesnew'}
          onClick={() => {
            navigate('/tenancies/:id/responsibilitiesnew')
            setSelectedItem('/tenancies/:id/responsibilitiesnew')
          }}
        >
          Create TenanciesIdResponsibilities
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/renewalNegotiations'}
          onClick={() => {
            navigate('/tenancies/:id/renewalNegotiations')
            setSelectedItem('/tenancies/:id/renewalNegotiations')
          }}
        >
          Get TenanciesIdRenewalNegotiations
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/renewalNegotiationsnew'}
          onClick={() => {
            navigate('/tenancies/:id/renewalNegotiationsnew')
            setSelectedItem('/tenancies/:id/renewalNegotiationsnew')
          }}
        >
          Create TenanciesIdRenewalNegotiations
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/extensions'}
          onClick={() => {
            navigate('/tenancies/:id/extensions')
            setSelectedItem('/tenancies/:id/extensions')
          }}
        >
          Get TenanciesIdExtensions
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/renewalNegotiations/:renewalId/checks'}
          onClick={() => {
            navigate('/tenancies/:id/renewalNegotiations/:renewalId/checks')
            setSelectedItem('/tenancies/:id/renewalNegotiations/:renewalId/checks')
          }}
        >
          Get TenanciesIdRenewalNegotiationsRenewalIdChecks
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/tenancies/:id/renewalNegotiations/:renewalId/checksnew'}
          onClick={() => {
            navigate('/tenancies/:id/renewalNegotiations/:renewalId/checksnew')
            setSelectedItem('/tenancies/:id/renewalNegotiations/:renewalId/checksnew')
          }}
        >
          Create TenanciesIdRenewalNegotiationsRenewalIdChecks
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/transactions/'}
          onClick={() => {
            navigate('/transactions/')
            setSelectedItem('/transactions/')
          }}
        >
          Get Transactions
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/transactions/nominalAccounts'}
          onClick={() => {
            navigate('/transactions/nominalAccounts')
            setSelectedItem('/transactions/nominalAccounts')
          }}
        >
          Get TransactionsNominalAccounts
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/transactions/supplierInvoicesnew'}
          onClick={() => {
            navigate('/transactions/supplierInvoicesnew')
            setSelectedItem('/transactions/supplierInvoicesnew')
          }}
        >
          Create TransactionsSupplierInvoices
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/vendors/'}
          onClick={() => {
            navigate('/vendors/')
            setSelectedItem('/vendors/')
          }}
        >
          Get Vendors
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/vendors/:id/relationships'}
          onClick={() => {
            navigate('/vendors/:id/relationships')
            setSelectedItem('/vendors/:id/relationships')
          }}
        >
          Get VendorsIdRelationships
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/vendors/:id/relationshipsnew'}
          onClick={() => {
            navigate('/vendors/:id/relationshipsnew')
            setSelectedItem('/vendors/:id/relationshipsnew')
          }}
        >
          Create VendorsIdRelationships
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/worksOrders/'}
          onClick={() => {
            navigate('/worksOrders/')
            setSelectedItem('/worksOrders/')
          }}
        >
          Get WorksOrders
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/worksOrders/new'}
          onClick={() => {
            navigate('/worksOrders/new')
            setSelectedItem('/worksOrders/new')
          }}
        >
          Create WorksOrders
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/worksOrders/:id/items'}
          onClick={() => {
            navigate('/worksOrders/:id/items')
            setSelectedItem('/worksOrders/:id/items')
          }}
        >
          Get WorksOrdersIdItems
        </SecondaryNavItem>
        <SecondaryNavItem
          active={selectedItem === '/worksOrders/:id/itemsnew'}
          onClick={() => {
            navigate('/worksOrders/:id/itemsnew')
            setSelectedItem('/worksOrders/:id/itemsnew')
          }}
        >
          Create WorksOrdersIdItems
        </SecondaryNavItem>
      </SecondaryNav>
    </SecondaryNavContainer>
  )
}
