import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Static-first per the jig www convention: fully prerendered, no server
  // surface. Removing this is a recorded deviation (DEVIATIONS.md).
  output: 'export',
}

export default nextConfig
