import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// NOTE: /api/v1 and /api/cron are deliberately NOT listed here.
// They are MACHINE endpoints: /api/v1/* authenticate with an opaque Fanout profile
// API key via verifyApiKey() (src/lib/auth.ts), and /api/cron/* with CRON_SECRET.
// Clerk's session middleware rejects those non-JWT credentials with a 307 to /sign-in
// before the route's own verifier can run, which breaks every machine caller.
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/dashboard(.*)',
  '/api/reports(.*)',
  '/api/upload(.*)',
  '/api/setup(.*)',
  '/api/links(.*)',
  '/api/biolink(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect({ unauthenticatedUrl: new URL('/sign-in', req.url).toString() })
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)|robots\\.txt|sitemap\\.xml).*)',
    '/(api|trpc)(.*)',
  ],
}
