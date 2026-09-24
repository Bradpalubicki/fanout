import { vi } from 'vitest'

/**
 * A Supabase query-builder fake that ACTUALLY APPLIES the filters a handler
 * builds, instead of recording them and returning canned rows.
 *
 * Why this exists. The previous fixtures (tests/api/v1-history.test.ts,
 * v1-account-analytics.test.ts) captured `.eq()` calls and then returned a
 * fixed array regardless. That proves a handler CALLED `.eq('profile_id', …)`;
 * it cannot prove the call had any effect. Measured 2026-09-23: seeding a row
 * explicitly owned by `profile-B` into those fixtures and running the suite
 * produced 18/18 passing — a handler returning a sibling tenant's data looked
 * identical to a correct one.
 *
 * Here the seeded table holds rows for THREE tenants at once — the caller (A),
 * a sibling profile in the same org (B), and a foreign org (C) — and the
 * builder filters them the way PostgREST would. A handler that forgets a
 * filter, or filters the wrong column, returns B's and C's rows and the test
 * sees it in the RESPONSE BODY.
 *
 * Deliberately unforgiving in one direction: an unfiltered read of a seeded
 * table is not an error here, it simply returns everything. That is the point
 * — the leak must show up as data, not as a thrown assertion inside the fake,
 * so the test asserts on what the caller would actually receive.
 */

export interface QueryRecord {
  table: string
  filters: Record<string, unknown>
}

type Row = Record<string, unknown>

export interface PredicateDb {
  /** Every query built during the test, in order. */
  calls: QueryRecord[]
  /** Replace the rows for one table. */
  seed(table: string, rows: Row[]): void
  /** The mock passed to vi.mock('@/lib/supabase'). */
  supabase: { from(table: string): unknown }
}

export function createPredicateDb(initial: Record<string, Row[]> = {}): PredicateDb {
  const tables: Record<string, Row[]> = { ...initial }
  const calls: QueryRecord[] = []

  function from(table: string) {
    const filters: Record<string, unknown> = {}
    calls.push({ table, filters })

    // Predicates accumulate and are applied together at await time, so order
    // of chaining cannot change the result — matching PostgREST.
    const eqs: [string, unknown][] = []
    const lts: [string, unknown][] = []
    const gtes: [string, unknown][] = []
    const ins: [string, unknown[]][] = []
    let orderBy: { column: string; ascending: boolean } | null = null
    let rowLimit: number | null = null

    const chain: Record<string, unknown> = {}
    const self = () => chain

    chain.select = vi.fn(() => self())

    chain.eq = vi.fn((col: string, val: unknown) => {
      filters[col] = val
      eqs.push([col, val])
      return self()
    })

    chain.in = vi.fn((col: string, vals: unknown[]) => {
      filters[col] = vals
      ins.push([col, vals])
      return self()
    })

    chain.lt = vi.fn((col: string, val: unknown) => {
      filters.lt = [col, val]
      lts.push([col, val])
      return self()
    })

    chain.gte = vi.fn((col: string, val: unknown) => {
      filters.gte = [col, val]
      gtes.push([col, val])
      return self()
    })

    chain.order = vi.fn((col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => {
      filters.order = [col, opts]
      orderBy = { column: col, ascending: opts?.ascending ?? true }
      return self()
    })

    chain.limit = vi.fn((n: number) => {
      filters.limit = n
      rowLimit = n
      return self()
    })

    function resolve() {
      let rows = [...(tables[table] ?? [])]

      for (const [col, val] of eqs) rows = rows.filter((r) => r[col] === val)
      for (const [col, vals] of ins) rows = rows.filter((r) => vals.includes(r[col]))
      for (const [col, val] of lts) {
        rows = rows.filter((r) => r[col] != null && String(r[col]) < String(val))
      }
      for (const [col, val] of gtes) {
        rows = rows.filter((r) => r[col] != null && String(r[col]) >= String(val))
      }

      if (orderBy) {
        const { column, ascending } = orderBy
        rows.sort((a, b) => {
          const av = a[column]
          const bv = b[column]
          // Nulls last, matching the route's nullsFirst: false.
          if (av == null && bv == null) return 0
          if (av == null) return 1
          if (bv == null) return -1
          const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0
          return ascending ? cmp : -cmp
        })
      }

      if (rowLimit != null) rows = rows.slice(0, rowLimit)
      return { data: rows, error: null }
    }

    // Terminal await (no .single()).
    chain.then = (onResolve: (v: unknown) => unknown) => onResolve(resolve())
    chain.single = async () => {
      const { data } = resolve()
      return { data: data[0] ?? null, error: data.length ? null : { message: 'No rows' } }
    }
    chain.maybeSingle = async () => {
      const { data } = resolve()
      return { data: data[0] ?? null, error: null }
    }

    return chain
  }

  return {
    calls,
    seed(table: string, rows: Row[]) {
      tables[table] = rows
    },
    supabase: { from },
  }
}

/**
 * The three principals every tenant-boundary probe uses.
 *
 * B is the one that matters most. A foreign org (C) is usually excluded by any
 * org-level check that exists at all; a SIBLING PROFILE INSIDE THE SAME ORG is
 * excluded only by a profile-level check. The defect this suite guards against
 * — resolving an org then fanning out across its profiles — returns A and B
 * while correctly excluding C, so a probe that omits B passes on a leak.
 */
export const PRINCIPALS = {
  A: { id: 'profile-A', org_id: 'org-1' },
  /** Sibling profile, SAME org as A. */
  B: { id: 'profile-B', org_id: 'org-1' },
  /** Foreign org entirely. */
  C: { id: 'profile-C', org_id: 'org-2' },
} as const
