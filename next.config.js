/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  images: {
    domains: [
      'firebasestorage.googleapis.com',
      'chatapp-uploads-082187380736.s3.us-east-2.amazonaws.com',
      'chatapp-uploads-082187380736.s3.amazonaws.com'
    ],
  },
  // Environment variables that will be available on the client side
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '0.1.0-beta',
  },
}

module.exports = nextConfig
