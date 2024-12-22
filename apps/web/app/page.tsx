'use client'

import { Header } from '@/components/ui/Header'
import Hero from '@/components/ui/Hero'
import Hero2 from '@/components/ui/Hero2'
import Hero3 from '@/components/ui/Hero3'
import { Splash } from '@/components/ui/splash'

// `app/page.tsx` is the UI for the `/` URL
const Page = () => {
  return (
    <div>
      <Header />

      <Splash />

      <Hero />

      <Hero2 />

      <Hero3 />
    </div>
  )
}

export default Page
