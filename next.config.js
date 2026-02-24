/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Transpile R3F packages for better ESM compatibility with Next.js 15
  transpilePackages: ['@react-three/fiber', '@react-three/drei', 'three'],
  // SUI SDK uses WebSocket which requires specific headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
};
