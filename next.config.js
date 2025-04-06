/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals = [...(config.externals || []), { 'socket.io-client': 'io' }];
    return config;
  },
}

module.exports = nextConfig;