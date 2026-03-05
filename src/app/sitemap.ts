import type { MetadataRoute } from "next";

const BLOG_POSTS = [
  { slug: "social-media-api-for-agencies", date: "2026-03-01" },
  { slug: "ayrshare-alternative-2026", date: "2026-02-28" },
  { slug: "multi-tenant-social-api", date: "2026-02-20" },
  { slug: "post-to-multiple-platforms-api", date: "2026-02-15" },
  { slug: "white-label-social-api", date: "2026-02-10" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://fanout.digital";
  const now = new Date();

  const blogPosts: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...blogPosts,
  ];
}
