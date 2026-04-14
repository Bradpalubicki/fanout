import type { FanoutPost, FanoutClientContext } from './types';

// Ayrshare integration — handles 13 platforms
export async function publishToAyrshare(
  post: FanoutPost,
  _context: FanoutClientContext
): Promise<{ platformPostId: string }> {
  const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;
  if (!AYRSHARE_API_KEY) throw new Error('AYRSHARE_API_KEY not set');

  const platformMap: Record<string, string> = {
    linkedin: 'linkedin',
    twitter: 'twitter',
    blog: 'ghost',  // Ghost for blog posts
    facebook: 'facebook',
    instagram: 'instagram',
    ghost: 'ghost',
    medium: 'medium',
    threads: 'threads',
  };

  const response = await fetch('https://app.ayrshare.com/api/post', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AYRSHARE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post: post.content,
      platforms: [platformMap[post.platform] || post.platform],
      scheduleDate: post.scheduledFor || undefined,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Ayrshare error: ${JSON.stringify(data)}`);

  return { platformPostId: data.id || 'unknown' };
}
