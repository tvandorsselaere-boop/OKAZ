import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://okaz-ia.fr';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date('2026-02-15'),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/mentions-legales`,
      lastModified: new Date('2026-02-15'),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/cgu`,
      lastModified: new Date('2026-02-15'),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ];
}
