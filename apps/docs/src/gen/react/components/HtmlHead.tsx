'use client'

import React from 'react'
import type { HtmlHeadProps } from '../types'

export const HtmlHead: React.FC<HtmlHeadProps> = ({ title, description }) => {
  React.useEffect(() => {
    document.title = title

    if (description) {
      let metaDescription = document.querySelector('meta[name="description"]')
      if (!metaDescription) {
        metaDescription = document.createElement('meta')
        metaDescription.setAttribute('name', 'description')
        document.head.appendChild(metaDescription)
      }
      metaDescription.setAttribute('content', description)
    }
  }, [title, description])

  return null
}
