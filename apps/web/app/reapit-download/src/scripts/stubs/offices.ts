import { OfficeModelPagedResult } from '@reapit/foundations-ts-definitions'

export const mockOfficeModelPagedResult: OfficeModelPagedResult = {
  _embedded: [
    {
      id: 'LEA',
      created: '2021-02-11T15:20:15Z',
      modified: '2021-02-11T15:20:15Z',
      name: 'London Estate Agent',
      manager: 'Mr John Smith',
      active: true,
      address: {
        buildingName: '257',
        buildingNumber: '15',
        line1: 'Example street',
        line2: 'Solihull',
        line3: 'West Midlands',
        line4: '',
        postcode: 'B91 2BD',
        countryId: 'GB',
      },
      additionalContactDetails: [],
      workPhone: '01234 567890',
      email: 'john@reapit.com',
      _eTag: '"0A5EB9C9D1B1C156BA189E64FCABE8F9"',
      extrasField: {},
      _links: {
        self: {
          href: '/offices/LEA',
        },
        negotiators: {
          href: '/negotiators/?officeId=LEA',
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
      href: '/offices/?PageNumber=1&PageSize=25&id=LEA',
    },
    first: {
      href: '/offices/?PageNumber=1&PageSize=25&id=LEA',
    },
  },
}
