import { ChevronRightIcon } from '@heroicons/react/20/solid'

const statuses = {
  offline: 'text-gray-500 bg-gray-100/10',
  online: 'text-green-400 bg-green-400/10',
  error: 'text-rose-400 bg-rose-400/10'
}
const environments = {
  Preview: 'text-gray-400 bg-gray-400/10 ring-gray-400/20',
  Production: 'text-indigo-400 bg-indigo-400/10 ring-indigo-400/30'
}

type Deployment = {
  id: number
  href: string
  projectName: string
  teamName: string
  status: keyof typeof statuses
  statusText: string
  description: string
  environment: keyof typeof environments
}

const deployments: Deployment[] = [
  {
    id: 1,
    href: '#',
    projectName: 'zod',
    teamName: '@codesquared',
    status: 'online',
    statusText: 'Last updated 4 weeks ago',
    description: 'v0.0.59',
    environment: 'Production'
  },
  {
    id: 2,
    href: '#',
    projectName: 'typescript',
    teamName: '@codesquared',
    status: 'online',
    statusText: 'Last updated 4 weeks ago',
    description: 'v0.0.33',
    environment: 'Production'
  },
  {
    id: 3,
    href: '#',
    projectName: 'tanstack-query-zod',
    teamName: '@codesquared',
    status: 'offline',
    statusText: 'Preparing to ship',
    description: 'v0.0.20',
    environment: 'Preview'
  },
  {
    id: 4,
    href: '#',
    projectName: 'shadcn-dashboard',
    teamName: '@codesquared',
    status: 'offline',
    statusText: 'Preparing to ship',
    description: 'v0.0.11',
    environment: 'Preview'
  },
  {
    id: 5,
    href: '#',
    projectName: 'rtk-query-zod',
    teamName: '@codesquared',
    status: 'offline',
    statusText: 'Shipping soon',
    description: 'v0.0.19',
    environment: 'Preview'
  }
]

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export const Libraries = () => {
  return (
    <ul role="list" className="not-prose">
      {deployments.map(deployment => (
        <li key={deployment.id} className="relative flex items-center space-x-4 py-4">
          <div className="min-w-0 flex-auto">
            <div className="flex items-center gap-x-3">
              <div
                className={classNames(statuses[deployment.status], 'flex-none rounded-full p-1')}
              >
                <div className="h-2 w-2 rounded-full bg-current" />
              </div>
              <h2 className="min-w-0 text-sm/6 font-semibold text-gray-600">
                <a href={deployment.href} className="flex gap-x-2 text-gray-600">
                  <span className="truncate">{deployment.teamName}</span>
                  <span className="text-gray-400">/</span>
                  <span className="whitespace-nowrap">{deployment.projectName}</span>
                  <span className="absolute inset-0" />
                </a>
              </h2>
            </div>
            <div className="mt-3 flex items-center gap-x-2.5 text-xs/5 text-gray-400">
              <p className="truncate">{deployment.description}</p>
              <svg viewBox="0 0 2 2" className="h-0.5 w-0.5 flex-none fill-gray-300">
                <circle r={1} cx={1} cy={1} />
              </svg>
              <p className="whitespace-nowrap">{deployment.statusText}</p>
            </div>
          </div>
          <div
            className={classNames(
              environments[deployment.environment],
              'flex-none rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset'
            )}
          >
            {deployment.environment}
          </div>
          <ChevronRightIcon aria-hidden="true" className="h-5 w-5 flex-none text-gray-400" />
        </li>
      ))}
    </ul>
  )
}
