import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  // "placeholder" is a non-empty string and therefore truthy, so the old
  // !!DSN check turned Sentry ON with an invalid DSN: no error reporting AND no
  // signal that reporting was off. Treat the placeholder as unset.
  enabled:
    !!process.env.NEXT_PUBLIC_SENTRY_DSN &&
    process.env.NEXT_PUBLIC_SENTRY_DSN !== 'placeholder',
})
