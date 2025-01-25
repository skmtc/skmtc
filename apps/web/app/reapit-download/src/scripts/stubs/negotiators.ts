import { NegotiatorModelPagedResult } from '@reapit/foundations-ts-definitions'

export const mockNegotiatorModelPagedResult: NegotiatorModelPagedResult = {
  _embedded: [
    {
      id: 'MRLN',
      created: '2021-10-31T15:12:46Z',
      modified: '2021-10-31T15:12:46Z',
      name: 'Mr Alfred Williamson',
      jobTitle: 'LL EA Sales Negotiator',
      officeId: 'TLE',
      workPhone: '01234 224466',
      mobilePhone: '07890 887755',
      email: 'a.williamson@email.com',
      active: true,
      _eTag: '"93E3A22E2258AD53312B8AE4E28C851E"',
      _links: {
        self: {
          href: '/negotiators/MRLN',
        },
        office: {
          href: '/offices/TLE',
        },
      },
      metadata: {},
    },
  ],
  pageNumber: 1,
  pageSize: 25,
  pageCount: 1,
  totalPageCount: 1,
  totalCount: 1,
  _links: {
    self: {
      href: '/negotiators/?PageNumber=1&PageSize=25&id=MRLN',
    },
    first: {
      href: '/negotiators/?PageNumber=1&PageSize=25&id=MRLN',
    },
  },
}
