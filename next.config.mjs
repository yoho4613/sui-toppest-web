/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Custom build ID to avoid nanoid compatibility issues with Node 22
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
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

export default nextConfig;
