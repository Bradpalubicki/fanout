import Anthropic from '@anthropic-ai/sdk';
import type { FanoutClientContext, FanoutPlatform, FanoutPost } from './types';
import { VERTICAL_CONTENT_CONTEXT } from './strategy';

let _client: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}

const PLATFORM_CONSTRAINTS: Record<FanoutPlatform, string> = {
  linkedin: 'LinkedIn post: 150-300 words. Professional tone. 3-5 paragraphs. End with a question or insight.',
  twitter: 'Twitter/X thread: 4-6 tweets. First tweet is the hook. Each tweet standalone. No hashtag spam.',
  blog: 'Blog post: 400-600 words. H2 subheadings. Regulatory citations where relevant. Ends with clear CTA.',
  facebook: 'Facebook post: 100-200 words. Conversational. Community-focused.',
  instagram: 'Instagram caption: 80-150 words. Visual hook. 5-8 relevant hashtags at end.',
  ghost: 'Ghost blog post: 500-800 words. SEO-optimized. H2/H3 structure. Internal links suggested.',
  medium: 'Medium article: 500-700 words. Story-driven. Professional audience.',
  threads: 'Threads post: 50-100 words. Casual. Conversational. Single insight.',
};

export async function generateFanoutPosts(
  context: FanoutClientContext,
  platforms: FanoutPlatform[],
  topic: string,
  jobId: string
): Promise<FanoutPost[]> {
  const client = getAnthropicClient();
  const verticalContext = VERTICAL_CONTENT_CONTEXT[context.vertical] || VERTICAL_CONTENT_CONTEXT.default;

  const systemPrompt = `You generate platform-native content for professional service businesses.

Vertical context: ${verticalContext}

Client: ${context.clientName} | ${context.vertical} | ${context.city || 'their service area'}
Website: ${context.website}

Rules:
- Write as a thought leader in the ${context.vertical} space
- Never mention NuStack or the fact that content is AI-generated
- Use specific regulatory citations where relevant (from the vertical context above)
- Every piece of content should demonstrate expertise, not sell services directly
- Platform-native: each platform gets different copy, not repurposed text

Output JSON only:
{
  "posts": [
    { "platform": "linkedin", "content": "..." },
    { "platform": "twitter", "content": "..." }
  ]
}`;

  const platformInstructions = platforms
    .map(p => `${p}: ${PLATFORM_CONSTRAINTS[p]}`)
    .join('\n');

  const userPrompt = `Topic: ${topic}\n\nGenerate content for these platforms:\n${platformInstructions}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return parsed.posts.map((p: { platform: string; content: string }, i: number) => ({
      id: `${jobId}-post-${i}`,
      jobId,
      platform: p.platform as FanoutPlatform,
      content: p.content,
      status: 'draft' as const,
    }));
  } catch {
    return platforms.map((platform, i) => ({
      id: `${jobId}-post-${i}`,
      jobId,
      platform,
      content: `Content for ${context.clientName} — ${topic}`,
      status: 'draft' as const,
    }));
  }
}

// Generate a full authority cluster (6 posts on a theme)
export async function generateAuthorityCluster(
  context: FanoutClientContext,
  theme: string,
  jobId: string
): Promise<{ topic: string; posts: FanoutPost[] }[]> {
  const clusterTopics = [
    `Why ${context.vertical} businesses lose clients before they even call`,
    `The compliance checklist every ${context.vertical} website needs in ${new Date().getFullYear()}`,
    `How to rank in local search as a ${context.vertical} professional`,
    `What ${context.vertical} clients look for before they trust a website`,
    `Case study: how a ${context.vertical} site in ${context.city || 'their market'} improved visibility`,
    `The technical mistakes ${context.vertical} websites make that hurt rankings`,
  ];

  const results = [];
  for (const topic of clusterTopics) {
    const posts = await generateFanoutPosts(context, ['linkedin', 'blog'], topic, `${jobId}-${results.length}`);
    results.push({ topic, posts });
  }
  return results;
}
