export const mockRootDenoJsonContents = {
  imports: {
    '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@^0.0.1',
    '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@^0.0.1',
    '@skmtc/gen-msw': 'jsr:@skmtc/gen-msw@^0.0.1'
  },
  workspace: ['./']
}

export const mockPackageDenoJsonContents = {
  name: '@test/generator',
  version: '0.0.1',
  exports: './mod.ts'
}
