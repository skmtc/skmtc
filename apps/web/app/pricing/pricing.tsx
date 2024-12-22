import { CheckCircleIcon } from '@heroicons/react/20/solid'

const tiers = [
  {
    name: 'Starter',
    id: 'tier-starter',
    href: '#',
    price: 'Free',
    description: 'Free forever.',
    features: [
      'Up to 20 API operations',
      'Up to 150 uploads',
      'Up to 1,000 calls',
      'Community support'
    ]
  },
  {
    name: 'Startup',
    id: 'tier-startup',
    href: '#',
    price: { monthly: '$49', initial: '$29' },
    description: 'Ideal for early stage startups.',
    features: [
      'Up to 50 API operations',
      'Up to 500 uploads',
      'Up to 10,000 calls',
      'Email support'
    ]
  },
  {
    name: 'Growth',
    id: 'tier-growth',
    href: '#',
    price: { monthly: '$249', initial: '$139' },
    description: 'Great for growing your business.',
    features: [
      'Up to 100 API operations',
      'Up to 1,000 uploads',
      'Unlimited calls',
      'Slack support'
    ]
  },
  {
    name: 'Founder membership',
    id: 'tier-founder',
    href: '#',
    price: { lifetime: '$499' },
    description: 'Help shape product roadmap. Limited to 1,000 subscribers.',
    features: [
      'Blink mode',
      'Unlimited API operations',
      'Unlimited uploads',
      'Unlimited calls',
      'Slack support'
    ]
  }
]

export const Pricing = () => {
  return (
    <div className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl sm:text-center">
          <h2 className="text-base/7 font-semibold text-indigo-600">Pricing</h2>
          <p className="mt-2 text-pretty text-5xl font-semibold tracking-tight text-gray-900 sm:text-balance sm:text-6xl">
            Pricing that grows with you
          </p>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg font-medium text-gray-600 sm:text-center sm:text-xl/8">
          Choose an affordable plan that’s packed with the best features for engaging your audience,
          creating customer loyalty, and driving sales.
        </p>
        <div className="mt-20 flow-root">
          <div className="isolate -mt-16 grid max-w-sm grid-cols-1 gap-y-16 divide-y divide-gray-100 sm:mx-auto lg:-mx-8 lg:mt-0 lg:max-w-none lg:grid-cols-4 lg:divide-x lg:divide-y-0 xl:-mx-4">
            {tiers.map(tier => (
              <div key={tier.id} className="pt-16 lg:px-4 lg:pt-0 xl:px-8">
                <h3 id={tier.id} className="text-base/7 font-semibold text-gray-900">
                  {tier.name}
                </h3>
                <PricingCard tier={tier} />
                <a
                  href={tier.href}
                  aria-describedby={tier.id}
                  className="mt-10 block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm/6 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  {tier.price === 'Free' ? 'Start now for free' : 'Buy plan'}
                </a>
                <p className="mt-10 text-sm/6 font-semibold text-gray-900">{tier.description}</p>
                <ul role="list" className="mt-6 space-y-3 text-sm/6 text-gray-600 pl-0">
                  {tier.features.map(feature => (
                    <li key={feature} className="flex gap-x-3">
                      <CheckCircleIcon
                        aria-hidden="true"
                        className="h-6 w-5 flex-none text-indigo-600"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

type PricingCardProps = {
  tier: (typeof tiers)[number]
}

const PricingCard = ({ tier }: PricingCardProps) => {
  if (tier.price === 'Free') {
    return (
      <p className="mt-6 flex items-baseline gap-x-1">
        <span>
          <span className="text-5xl font-semibold tracking-tight text-gray-900">{tier.price}</span>
        </span>
      </p>
    )
  }

  if (typeof tier.price === 'object' && 'lifetime' in tier.price) {
    return (
      <p className="mt-6 flex items-baseline gap-x-1">
        <span>
          <span className="text-5xl font-semibold tracking-tight text-gray-900">
            {tier.price.lifetime}
          </span>
          <span className="text-sm/6 font-semibold text-gray-900"> one-time</span>
        </span>
      </p>
    )
  }
  if (typeof tier.price === 'object' && 'monthly' in tier.price) {
    return (
      <p className="mt-6 flex items-baseline gap-x-1">
        <span className="text-4xl font-semibold tracking-tight text-gray-500 line-through">
          {tier.price.monthly}
        </span>{' '}
        <span>
          <span className="text-5xl font-semibold tracking-tight text-gray-900">
            {tier.price.initial}
          </span>
          <span className="text-sm/6 font-semibold text-gray-600">/month</span>
        </span>
      </p>
    )
  }
  return null
}
