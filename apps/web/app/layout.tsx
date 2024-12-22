import type { Metadata } from 'next'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Analytics } from '@vercel/analytics/react'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'CodeSquared - Generate TypeScript from OpenAPI',
  description: `CodeSquared is a code generation system that let's you ship fast by programatically generating frontend code from your API definition`
}

const RootLayout = ({
  children
}: Readonly<{
  children: React.ReactNode
}>) => {
  return (
    <html lang="en" className="light prose prose-invert max-w-7xl bg-[#fbf7f0]">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className={GeistMono.className}>
        {children}
        <Toaster />
      </body>
      <Analytics />
    </html>
  )
}

export default RootLayout
