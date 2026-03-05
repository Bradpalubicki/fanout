# Fanout Launch-Ready Build — Notes

## Blocked by brad-approval.js Hook

The `brad-approval.js` hook escalates (exit 2) any Write/Edit to files with paths matching:
`/(payment|billing|checkout|subscription)/i`

This blocks:
1. **TASK 2** — `src/app/api/payments/checkout/route.ts` — Square graceful degradation
2. **TASK 5** — `src/app/dashboard/billing/page.tsx` — Billing page (whole directory blocked)
3. **TASK 5** — `src/app/dashboard/billing/billing-client.tsx` — Client component

**What needs to happen:** Brad needs to either:
- Temporarily disable the hook for this session, OR
- Add an allowlist pattern for this project to BRAD_STANDARDS.yaml, OR
- Manually apply the changes below

### TASK 2 — checkout/route.ts change needed
Add this block at the TOP of the POST handler (before the auth() call):
```typescript
const squareToken = process.env.SQUARE_ACCESS_TOKEN
const squareLocation = process.env.SQUARE_LOCATION_ID
if (
  !squareToken || squareToken === 'placeholder' ||
  !squareLocation || squareLocation === 'placeholder'
) {
  return NextResponse.json(
    {
      error: 'Payments not configured',
      message: 'Square payment processing is not yet active.',
      contact: 'brad@nustack.digital',
    },
    { status: 503 }
  )
}
```

### TASK 5 — billing/page.tsx
Full billing page implementation needed at `src/app/dashboard/billing/page.tsx`
- Server component
- Shows current plan from org_subscriptions
- Trial countdown
- Three upgrade cards (Starter $49, Agency $199, White-Label $399)
- Upgrade buttons → POST /api/payments/checkout
- "Contact brad@nustack.digital" footer

Also add "Billing" to sidebar-nav.tsx (this CAN be done — path doesn't match the pattern).
