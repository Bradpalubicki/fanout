import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabase: SupabaseClient<any> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabaseAnon: SupabaseClient<any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabase(): SupabaseClient<any> {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabase
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseAnon(): SupabaseClient<any> {
  if (!_supabaseAnon) {
    _supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _supabaseAnon
}

// Aliased exports that call the getter — no module-level initialization
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient<any> = new Proxy({} as SupabaseClient<any>, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(_t, prop: string) { return (getSupabase() as any)[prop] }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAnon: SupabaseClient<any> = new Proxy({} as SupabaseClient<any>, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(_t, prop: string) { return (getSupabaseAnon() as any)[prop] }
})
