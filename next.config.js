/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  images: {
    domains: [
      'firebasestorage.googleapis.com',
      'chatapp-uploads-082187380736.s3.us-east-2.amazonaws.com',
      'chatapp-uploads-082187380736.s3.amazonaws.com'
    ],
  },
}

module.exports = nextConfig