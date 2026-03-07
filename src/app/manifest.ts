import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GymCRM Profesional',
    short_name: 'GymCRM',
    description: 'CRM para gimnasios con membresías, reservas, check-ins, pagos y comunidad.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0b1020',
    theme_color: '#111827',
    lang: 'es-UY',
    orientation: 'portrait',
    categories: ['business', 'health', 'productivity'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
