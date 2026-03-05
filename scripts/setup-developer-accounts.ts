/**
 * Setup guide for Fanout developer accounts.
 * Run: npx ts-node scripts/setup-developer-accounts.ts
 * Outputs: scripts/output/developer-accounts-setup.md
 */

import fs from 'fs'
import path from 'path'
import { generateTotpSecret } from '../src/lib/oauth-registration/totp'

const OUTPUT_DIR = path.join(__dirname, 'output')
fs.mkdirSync(OUTPUT_DIR, { recursive: true })

// Generate TOTP secrets for each platform
const platforms = ['reddit', 'twitter', 'linkedin', 'youtube', 'pinterest', 'tiktok']
const secrets = platforms.map((platform) => {
  const { secret, otpauthUrl } = generateTotpSecret(`fanout-${platform}@nustack.digital`, 'Fanout')
  return { platform, email: `fanout-${platform}@nustack.digital`, secret, otpauthUrl }
})

const envEntries = secrets.map((s) =>
  `# ${s.platform.toUpperCase()} TOTP Secret (scan QR or enter manually in authenticator app)\n` +
  `TOTP_SECRET_${s.platform.toUpperCase()}=${s.secret}`
).join('\n\n')

const report = `# Fanout Developer Account Setup Guide
Generated: ${new Date().toISOString()}

## Step 1: Create Developer Email Accounts

Use these email addresses when registering on each platform's developer portal.
All emails route to brad@nustack.digital via Cloudflare Email Routing.

| Platform | Developer Email |
|----------|----------------|
${secrets.map((s) => `| ${s.platform} | ${s.email} |`).join('\n')}

**Configure Cloudflare Email Routing:**
1. Dashboard → Email → Email Routing → Add address
2. Add each \`fanout-{platform}@nustack.digital\` address
3. Forward to webhook: \`https://fanout.digital/api/webhooks/inbound-email\`
4. Set \`EMAIL_ROUTING_SECRET\` in Vercel env vars

---

## Step 2: Set Up TOTP Secrets

Add these to Vercel environment variables, then insert into Supabase:

\`\`\`env
${envEntries}
\`\`\`

**Insert into Supabase developer_accounts table:**
\`\`\`sql
${secrets.map((s) =>
  `INSERT INTO developer_accounts (platform, email, totp_secret)\n` +
  `  VALUES ('${s.platform}', '${s.email}', '${s.secret}')\n` +
  `  ON CONFLICT (platform) DO UPDATE SET totp_secret = EXCLUDED.totp_secret;`
).join('\n\n')}
\`\`\`

**To enroll TOTP in each app:**
Scan these QR code URIs with Google Authenticator or Authy:
${secrets.map((s) => `- **${s.platform}**: \`${s.otpauthUrl}\``).join('\n')}

---

## Step 3: SMS 2FA via Twilio (Fanout phone number)

Configure the Fanout Twilio number to forward inbound SMS to:
  \`https://fanout.digital/api/webhooks/inbound-sms\`

In Twilio Console:
1. Phone Numbers → Manage → Active Numbers → [Fanout number]
2. Messaging → "A message comes in" → Webhook → POST → \`https://fanout.digital/api/webhooks/inbound-sms\`

The webhook auto-detects which platform the SMS is from by sender short code.

---

## Step 4: Bootstrap Browser Sessions

After accounts are created and TOTP is enrolled, bootstrap each session:

\`\`\`bash
# Reddit (no 2FA — start here)
npx ts-node scripts/bootstrap-session.ts reddit

# Twitter
npx ts-node scripts/bootstrap-session.ts twitter

# LinkedIn
npx ts-node scripts/bootstrap-session.ts linkedin

# YouTube/Google
npx ts-node scripts/bootstrap-session.ts youtube
\`\`\`

Each session is saved to \`C:\\Users\\bradp\\.fanout-sessions\\{platform}\\\`
Sessions are valid for 30 days, then need re-bootstrap.

---

## Step 5: Auto-Register All Apps

Once sessions are bootstrapped:

\`\`\`bash
curl -X POST https://fanout.digital/api/admin/check-oauth-apps \\
  -H "x-admin-key: \$FANOUT_ADMIN_KEY"
\`\`\`

Or visit: https://fanout.digital/dashboard/admin/oauth-apps

---

## Verification

Run this to verify all credentials work:
\`\`\`bash
curl https://fanout.digital/api/admin/check-oauth-apps \\
  -H "x-admin-key: \$FANOUT_ADMIN_KEY"
\`\`\`

---

## Platform Status

| Platform | Can Automate | 2FA | Review Required | Priority |
|----------|-------------|-----|----------------|----------|
| Reddit | ✅ Yes | No | No | 1 — Do first |
| Twitter | ✅ Yes | TOTP | No | 2 |
| LinkedIn | ✅ Yes | TOTP | Yes | 3 |
| YouTube | ✅ Yes | TOTP | No | 4 |
| Pinterest | ❌ No | SMS | Yes | Manual |
| TikTok | ❌ No | SMS | Yes | Manual |
| Facebook | ❌ No | SMS | Yes | Manual (Meta app) |
| Instagram | ❌ No | SMS | Yes | Manual (same Meta app) |
| Threads | ❌ No | SMS | Yes | Manual (same Meta app) |
`

fs.writeFileSync(path.join(OUTPUT_DIR, 'developer-accounts-setup.md'), report)
console.log('✅ Setup guide written to: scripts/output/developer-accounts-setup.md')
console.log('\nReview the file, then follow steps in order.')
console.log('Start with Step 4 (Reddit bootstrap — no 2FA required).')
