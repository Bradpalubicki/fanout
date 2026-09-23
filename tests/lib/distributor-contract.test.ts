import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const DIR = path.join(process.cwd(), 'src', 'distributors')
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.ts') && f !== 'base.ts')

/**
 * Structural guard, not a unit test. CX claimed the distributors ignore res.ok;
 * they do not, because they all go through base.fetchJson which returns {ok}.
 * That is only true while nobody adds a raw fetch() whose status goes unchecked
 * — which is precisely how F2 shipped. This fails the moment someone does.
 */
describe('distributor fetch discipline', () => {
  it('finds the distributor sources', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(files)('%s checks the status of every raw fetch() it makes', (file) => {
    const src = fs.readFileSync(path.join(DIR, file), 'utf-8')
    const rawFetches = (src.match(/await fetch\(/g) ?? []).length
    if (rawFetches === 0) return // uses base.fetchJson — already guarded
    const okChecks = (src.match(/\.ok\b/g) ?? []).length
    expect(
      okChecks,
      `${file} makes ${rawFetches} raw fetch() call(s) but has ${okChecks} .ok check(s). ` +
        `fetch() resolves on 4xx/5xx — an unchecked response reads as success.`
    ).toBeGreaterThanOrEqual(rawFetches)
  })

  it.each(files)('%s exports a class extending BaseDistributor', (file) => {
    const src = fs.readFileSync(path.join(DIR, file), 'utf-8')
    expect(src).toMatch(/extends BaseDistributor/)
  })
})
