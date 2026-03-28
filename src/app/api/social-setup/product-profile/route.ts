export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabase } from '@/lib/supabase'
import { PRODUCTS, PRODUCT_CONFIGS } from '@/lib/product-platforms'
import { generateApiKey, hashApiKey } from '@/lib/crypto'

// Returns (or creates) the internal Fanout profile_id for a NuStack product.
// Used by the social setup wizard to get a profileId for OAuth authorize redirects.
//
// NuStack product accounts are stored in profiles with slug = product name.
// They belong to the admin org (NUSTACK_ADMIN_ORG_ID env var) or the authed org.

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const product = req.nextUrl.searchParams.get('product')
  if (!product || !PRODUCTS.includes(product as typeof PRODUCTS[number])) {
    return NextResponse.json({ error: 'Invalid product' }, { status: 400 })
  }

  const cfg = PRODUCT_CONFIGS[product as typeof PRODUCTS[number]]
  const slug = product // e.g. "certusaudit"

  const supabase = getSupabase()

  // Look for existing profile with this slug
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ profile_id: existing.id, name: existing.name, slug: existing.slug, created: false })
  }

  // Create the internal profile
  const apiKey = generateApiKey()
  const apiKeyHash = hashApiKey(apiKey)

  const { data: profile, error } = await supabase
    .from('profiles')
    .insert({
      org_id: orgId,
      name: cfg.name,
      slug,
      api_key_hash: apiKeyHash,
      timezone: 'America/Chicago',
    })
    .select('id, name, slug')
    .single()

  if (error) {
    return NextResponse.json({ error: `Failed to create profile: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ profile_id: profile.id, name: profile.name, slug: profile.slug, created: true })
}
