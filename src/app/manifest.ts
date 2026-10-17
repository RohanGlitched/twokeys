import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Two Keys',
    short_name: 'Two Keys',
    description: 'Compare carrier results as a couple, privately.',
    start_url: '/phone',
    display: 'standalone',
    background_color: '#F1EEE8',
    theme_color: '#22201E',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
