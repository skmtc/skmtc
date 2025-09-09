import React from 'react';
import type { SectionProps } from '../types';

export const Section: React.FC<SectionProps> = ({ title, content, id }) => {
  return (
    <section className="my-8" id={id}>
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <div className="pl-4">{content}</div>
    </section>
  );
};