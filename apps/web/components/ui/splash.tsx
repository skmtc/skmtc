export const Splash = () => {
  return (
    <div className="relative isolate px-6 pt-8 lg:px-8">
      <div className="mx-auto max-w-4xl py-8 sm:py-12 lg:py-16">
        <div className="text-center">
          <h1 className="text-4xl font-normal tracking-tight text-gray-900 sm:text-6xl">
            Universal code generator for TypeScript developers
          </h1>

          <p className="mt-6 text-lg leading-8 text-gray-600">
            Instantly generate TypeScript from API schemas in Cursor or VS Code
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <a
              href="https://docs.codesquared.com"
              className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 no-underline"
            >
              Get started
            </a>
            <a
              href="#api-source"
              className="text-sm font-semibold leading-6 text-gray-900 no-underline"
            >
              Learn more <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
      <div className="flex justify-center items-center">
        <video controls>
          <source src="./codesquared.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  )
}
