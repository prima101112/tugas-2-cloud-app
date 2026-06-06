/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['dockerode', 'docker-modem', 'ssh2', 'cpu-features'],
  },
}
module.exports = nextConfig
