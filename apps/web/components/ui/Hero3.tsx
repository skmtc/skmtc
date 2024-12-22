import MDX from '@/components/content/output.mdx'

const Hero = () => {
  return (
    <div className="overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h2 className="text-base font-semibold leading-7 text-indigo-600">
              Automate development
            </h2>
            <h1 className="mt-2 text-3xl font-normal tracking-tight text-gray-900 sm:text-4xl">
              <div>Ready to run</div>
              <div>output code</div>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Use generated code as building blocks or compose them into a full application.
            </p>
          </div>

          <div className="lg:col-span-3">
            <MDX />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Hero
