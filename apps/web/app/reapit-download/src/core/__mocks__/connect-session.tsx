import { ReapitConnectSession } from '@reapit/connect-session'

export const mockBrowserSession: ReapitConnectSession = {
  accessToken: 'MOCK_ACCESS_TOKEN',
  refreshToken: 'MOCK_REFRESH_TOKEN',
  idToken: 'MOCK_ID_TOKEN',
  loginIdentity: {
    email: 'name@mail.com',
    name: 'name',
    developerId: 'SOME_DEVELOPER_ID',
    clientId: 'SOME_CLIENT_ID',
    adminId: 'SOME_ADMIN_ID',
    userCode: 'SOME_USER_ID',
    orgName: 'SOME_ORG_NAME',
    orgId: 'SOME_ORG_ID',
    groups: [
      'AgencyCloudDeveloperEdition',
      'OrganisationAdmin',
      'ReapitUser',
      'ReapitDeveloper',
      'ReapitDeveloperAdmin',
    ],
    offGroupIds: 'MKV',
    offGrouping: true,
    offGroupName: 'Cool Office Group',
    officeId: 'MVK',
    orgProduct: 'agencyCloud',
    agencyCloudId: 'SOME_AC_ID',
  },
}

export const reapitConnectBrowserSession = { connectSession: () => Promise.resolve(mockBrowserSession) }
