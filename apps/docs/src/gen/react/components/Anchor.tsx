import React from 'react'
import { LinkIcon } from './Icon'

interface AnchorProps {
  id: string
}

export const Anchor: React.FC<AnchorProps> = ({ id }) => (
  <a href={id} className="anchor" aria-label="Anchor" tabIndex={-1}>
    <LinkIcon />
  </a>
)
