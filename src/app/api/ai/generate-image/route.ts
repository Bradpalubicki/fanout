import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { put } from '@vercel/blob'
import { z } from 'zod'
import Replicate from 'replicate'

const schema = z.object({
  prompt: z.string().min(1).max(1000),
  platform: z.enum(['twitter', 'instagram', 'linkedin', 'pinterest', 'facebook', 'default']).default('default'),
})

// Platform-specific aspect ratios for Flux
const ASPECT_RATIOS: Record<string, string> = {
  twitter: '16:9',      // 1200x675
  instagram: '1:1',     // 1080x1080
  linkedin: '1.91:1',   // 1200x627
  pinterest: '2:3',     // 1000x1500
  facebook: '1.91:1',   // 1200x630
  default: '16:9',
}

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { prompt, platform } = parsed.data

  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json({ error: 'Image generation not configured' }, { status: 503 })
  }

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

  const aspectRatio = ASPECT_RATIOS[platform] ?? '16:9'

  const output = await replicate.run(
    'black-forest-labs/flux-schnell',
    {
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        output_format: 'webp',
        output_quality: 90,
        num_outputs: 1,
      },
    }
  ) as string[]

  const imageUrl = Array.isArray(output) ? output[0] : output
  if (!imageUrl) {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }

  // Fetch and upload to Vercel Blob for permanent storage
  const imgRes = await fetch(imageUrl as string)
  const imgBuffer = await imgRes.arrayBuffer()
  const filename = `fanout/ai-generated/${orgId}/${Date.now()}.webp`
  const blob = await put(filename, Buffer.from(imgBuffer), {
    access: 'public',
    contentType: 'image/webp',
  })

  return NextResponse.json({ url: blob.url })
}
