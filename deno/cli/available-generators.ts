export type AvailableGenerator = {
  id: string
  name: string
  github: string
  version: string
  description: string
  launchInclude: boolean
  dependencies: string[]
  icon?: string
}

export const availableGenerators: AvailableGenerator[] = [
  {
    id: '@skmtc/gen-shadcn-table',
    name: '@skmtc/gen-shadcn-table',
    github: 'skmtc/skmtc-generators/tree/main/gen-shadcn-table',
    icon: 'shadcn.svg',
    version: '0.0.x',
    description: 'Generate Shadcn UI table components',
    launchInclude: true,
    dependencies: [
      '@skmtc/gen-zod',
      '@skmtc/gen-typescript',
      '@skmtc/gen-tanstack-query-fetch-zod',
      '@skmtc/gen-msw'
    ]
  },
  {
    id: '@skmtc/gen-shadcn-form',
    name: '@skmtc/gen-shadcn-form',
    github: 'skmtc/skmtc-generators/tree/main/gen-shadcn-form',
    icon: 'shadcn.svg',
    version: '0.0.x',
    description: 'Generate Shadcn UI form components',
    launchInclude: true,
    dependencies: ['@skmtc/gen-zod', '@skmtc/gen-typescript', '@skmtc/gen-tanstack-query-fetch-zod']
  },
  {
    id: '@skmtc/gen-shadcn-select',
    name: '@skmtc/gen-shadcn-select',
    github: 'skmtc/skmtc-generators/tree/main/gen-shadcn-select',
    icon: 'shadcn.svg',
    version: '0.0.x',
    description: 'Generate Shadcn UI select components with api driven options',
    launchInclude: true,
    dependencies: ['@skmtc/gen-zod', '@skmtc/gen-typescript', '@skmtc/gen-tanstack-query-fetch-zod']
  },
  {
    id: '@skmtc/gen-msw',
    name: '@skmtc/gen-msw',
    github: 'skmtc/skmtc-generators/tree/main/gen-msw',
    icon: 'mock-service-worker.svg',
    version: '0.0.x',
    description: 'Generate MSW mock server handlers from schema examples',
    launchInclude: true,
    dependencies: []
  },
  {
    id: '@skmtc/gen-tanstack-query-fetch-zod',
    name: '@skmtc/gen-tanstack-query-fetch-zod',
    github: 'skmtc/skmtc-generators/tree/main/gen-tanstack-query-fetch-zod',
    icon: 'tanstack-query.svg',
    version: '0.0.x',
    description: 'Generate Tanstack React Query hooks with fetch and Zod runtime type checking',
    launchInclude: true,
    dependencies: ['@skmtc/gen-zod', '@skmtc/gen-typescript']
  },
  {
    id: '@skmtc/gen-tanstack-query-supabase-zod',
    name: '@skmtc/gen-tanstack-query-supabase-zod',
    github: 'skmtc/skmtc-generators/tree/main/gen-tanstack-query-supabase-zod',
    icon: 'tanstack-query.svg',
    version: '0.0.x',
    description:
      'Generate Tanstack React Query hooks with Supabase client and Zod runtime type checking',
    launchInclude: true,
    dependencies: ['@skmtc/gen-zod', '@skmtc/gen-typescript']
  },
  {
    id: '@skmtc/gen-supabase-hono',
    name: '@skmtc/gen-supabase-hono',
    github: 'skmtc/skmtc-generators/tree/main/gen-supabase-hono',
    icon: 'supabase.svg',
    version: '0.0.x',
    description: 'Generate Supabase and Hono edge functions with Zod type checking',
    launchInclude: false,
    dependencies: ['@skmtc/gen-zod', '@skmtc/gen-typescript']
  },
  {
    id: '@skmtc/gen-zod',
    name: '@skmtc/gen-zod',
    github: 'skmtc/skmtc-generators/tree/main/gen-zod',
    icon: 'zod.svg',
    version: '0.0.x',
    description: 'Generate Zod v4 schemas',
    launchInclude: true,
    dependencies: []
  },
  {
    id: '@skmtc/gen-typescript',
    name: '@skmtc/gen-typescript',
    github: 'skmtc/skmtc-generators/tree/main/gen-typescript',
    version: '0.0.x',
    description: 'Generate TypeScript types',
    icon: 'typescript.svg',
    launchInclude: true,
    dependencies: []
  }
]
