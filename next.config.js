/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.s3.us-east-2.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
      },
    ],
  },
  // Environment variables that will be available on the client side
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '0.1.0-beta',
  },
}

module.exports = nextConfig
