import React from 'react';
import type { AnchorProps } from '../types';

export const Anchor: React.FC<AnchorProps> = ({ id }) => {
  return <div id={id} className="anchor" />;
};