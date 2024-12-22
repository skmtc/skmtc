import { Libraries } from '@/components/libraries/libraries'

const Hero = () => {
  return (
    <div className="overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 className="text-base font-semibold leading-7 text-indigo-600">Ready to use</h2>
            <h1
              id="api-source"
              className="mt-2 text-3xl font-normal tracking-tight text-gray-900 sm:text-4xl"
            >
              Open source generators
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              We have created generators for popular TypeScript libraries to help you get started
              fast. You can use them immediately, customize them or combine them to create your
              perfect generator stack.
            </p>

            <p className="mt-6 text-lg leading-8 text-gray-600">
              Want to see a generator added? Drop us an email at{' '}
              <a href="mailto:support@codesquared.com" className="text-gray-600">
                support@codesquared.com
              </a>
            </p>
          </div>
          <div></div>
          <div className="lg:col-span-6 pt-16">
            <Libraries />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Hero
