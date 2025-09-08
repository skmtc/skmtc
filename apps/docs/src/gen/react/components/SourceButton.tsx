import React from 'react';
import { SourceIcon } from './Icon';

interface SourceButtonProps {
  href: string;
}

export const SourceButton: React.FC<SourceButtonProps> = ({ href }) => (
  <a className="sourceButton" href={href}>
    <SourceIcon />
  </a>
);