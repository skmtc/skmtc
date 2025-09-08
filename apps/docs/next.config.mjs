import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'export', // Enable static site generation
  // trailingSlash: true,
  images: {
    unoptimized: true // Required for static export
  }
};

export default withMDX(config);
