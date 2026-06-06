/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['dockerode', 'docker-modem', 'ssh2', 'cpu-features'],
  async rewrites() {
    return [
      {
        source: '/ws/:path*',
        destination: 'http://127.0.0.1:3000/ws/:path*',
      },
    ]
  },
}

module.exports = nextConfig
