import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Toppest - Play to Earn on SUI Network',
    short_name: 'Toppest',
    description: 'Play to Earn on SUI Network - Compete in mini-games and earn rewards',
    start_url: '/play',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: '#3b82f6',
    scope: '/play',
    lang: 'en',
    dir: 'ltr',
    categories: ['games', 'entertainment', 'finance'],
    icons: [
      {
        src: '/icons/icon-192x192.png?v=3',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png?v=3',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/maskable-icon-192x192.png?v=3',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/maskable-icon-512x512.png?v=3',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    prefer_related_applications: false,
  }
}
