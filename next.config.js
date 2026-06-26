/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [{ source: '/how-it-works', destination: '/why-us', permanent: true }]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig
