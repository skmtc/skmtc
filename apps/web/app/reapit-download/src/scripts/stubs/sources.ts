import { SourceModelPagedResult } from '@reapit/foundations-ts-definitions'

export const mockSourceModelPagedResult: SourceModelPagedResult = {
  _embedded: [
    {
      id: 'SRC157',
      created: '2022-08-02T11:38:13.0000000Z',
      modified: '2022-08-02T11:38:13.0000000Z',
      name: 'Propertyfinder WhatsApp',
      type: 'source',
      officeIds: [],
      departmentIds: [],
      _eTag: '"A14777181529994196E3CDA0E05335ED"',
      _links: {
        self: {
          href: '/sources/SRC157',
        },
      },
    },
  ],
  pageNumber: 1,
  pageSize: 25,
  pageCount: 1,
  totalPageCount: 1,
  totalCount: 1,
  _links: {
    self: {
      href: '/sources/?PageNumber=1&PageSize=25&id=SRC157',
    },
    first: {
      href: '/sources/?PageNumber=1&PageSize=25&id=SRC157',
    },
  },
}
