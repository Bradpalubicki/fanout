import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://fanout.digital'

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/docs`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/sign-up`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.7 },
    { url: `${base}/sign-in`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
  ]
}
