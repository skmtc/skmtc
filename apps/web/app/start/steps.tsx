import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { match } from 'ts-pattern'

const steps = [
  { id: 'Step 1', name: 'Upload schema', href: '/start', status: 'complete' as const },
  {
    id: 'Step 2',
    name: 'Select generators',
    href: '/start/select-generators',
    status: 'current' as const
  },
  { id: 'Step 3', name: 'View results', href: '/start/view-results', status: 'upcoming' as const }
]

export const Steps = () => {
  const pathname = usePathname()

  const currentStep = match(pathname)
    .with('/start', () => 1)
    .with('/start/select-generators', () => 2)
    .with('/start/view-results', () => 3)
    .otherwise(() => {
      throw new Error('Invalid path')
    })

  return (
    <nav aria-label="Progress">
      <ol role="list" className="space-y-4 md:flex md:space-x-8 md:space-y-0 not-prose">
        {steps.map((step, index) => {
          const status =
            index + 1 < currentStep
              ? ('complete' as const)
              : index + 1 === currentStep
              ? ('current' as const)
              : ('upcoming' as const)

          return (
            <li key={step.name} className="md:flex-1">
              {match(status)
                .with('complete', () => (
                  <Link
                    href={step.href}
                    aria-current="step"
                    className="group flex flex-col border-l-4 border-indigo-600 py-2 pl-4 hover:border-indigo-800 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4"
                  >
                    <span className="text-sm font-medium text-gray-500 group-hover:text-gray-700">
                      {step.id}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{step.name}</span>
                  </Link>
                ))
                .with('current', () => (
                  <Link
                    href={step.href}
                    aria-current="step"
                    className="group flex flex-col border-l-4 border-indigo-600 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4"
                  >
                    <span className="text-sm font-medium text-indigo-600">{step.id}</span>
                    <span className="text-sm font-medium text-gray-900">{step.name}</span>
                  </Link>
                ))
                .with('upcoming', () => (
                  <Link
                    href={step.href}
                    className="group flex flex-col border-l-4 border-gray-200 py-2 pl-4 hover:border-gray-300 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4"
                  >
                    <span className="text-sm font-medium text-gray-500 group-hover:text-gray-700">
                      {step.id}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{step.name}</span>
                  </Link>
                ))
                .exhaustive()}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
