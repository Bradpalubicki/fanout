#!/usr/bin/env node
/**
 * Generates the client social-media credentials workbook.
 *
 * This is a REPRODUCIBLE TEMPLATE: re-run it to regenerate the file after
 * changing the platform rows below. Never hand-edit the .xlsx as the source of
 * truth — it will drift from what Fanout actually requires.
 *
 * Platform requirements are taken from src/lib/oauth-config.ts (scopes, which
 * accounts are supported) and the connect routes, not from generic advice.
 *
 * Usage: node scripts/build-client-credentials-workbook.mjs
 */

import ExcelJS from 'exceljs'
import path from 'path'

// ── Design tokens ───────────────────────────────────────────────────────────
const NAVY = 'FF0A1628'
const GOLD = 'FFF5C842'
const WHITE = 'FFFFFFFF'
const LIGHT = 'FFF6F7F9'
const BORDER = 'FFD8DDE4'
const RED = 'FFB42318'
const GREEN = 'FF16A34A'

const thin = { style: 'thin', color: { argb: BORDER } }
const boxed = { top: thin, left: thin, bottom: thin, right: thin }

/**
 * One row per platform. `fields` are what the CLIENT must actually provide.
 *
 * Deliberately does NOT ask for the Fanout login — Fanout uses Clerk sign-up,
 * and no one should be writing that into a shared spreadsheet.
 *
 * CREDENTIAL COLUMNS: Brad requires username/password columns so he can create
 * the accounts on the client's behalf. Fanout itself never needs them — OAuth
 * means the client approves access on the provider's own screen and the password
 * is never shared with us. These columns exist for ACCOUNT CREATION, which is a
 * separate job, and the workbook says so plainly rather than implying Fanout
 * stores passwords. The handling guidance on "Start Here" is part of the
 * deliverable, not decoration.
 */
const PLATFORMS = [
  {
    name: 'Facebook Page',
    url: 'https://www.facebook.com/pages/create',
    accountType: 'Business Page (NOT a personal profile)',
    required: 'Required',
    fields: [
      'Page name (exactly as it should appear)',
      'Page URL once created',
      'Business Manager / portfolio name (if the Page lives in one)',
      'Page admin email',
    ],
    notes:
      'Fanout posts to a PAGE. Meta removed API posting to personal timelines. If the Page sits in a Business portfolio, we need access to that portfolio too.',
  },
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/accounts/signup/',
    accountType: 'Business or Creator account, linked to the Facebook Page',
    required: 'Required',
    fields: [
      'Instagram handle (@...)',
      'Confirm it is switched to Business or Creator',
      'Confirm it is linked to the Facebook Page above',
    ],
    notes:
      'A personal Instagram account cannot post via API. Switch to Business/Creator in Settings, then link it to the Facebook Page.',
  },
  {
    name: 'X / Twitter',
    url: 'https://x.com/i/flow/signup',
    accountType: 'Standard account',
    required: 'Optional',
    fields: ['Handle (@...)', 'Account email', 'Phone number on the account (if any)'],
    notes: 'Posting and reading both supported. No business account needed.',
  },
  {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/company/setup/new/',
    accountType: 'Company Page + an admin personal account',
    required: 'Optional',
    fields: [
      'Company Page URL',
      'Name of the person who administers the Page',
      'That person’s LinkedIn email',
    ],
    notes:
      'IMPORTANT: LinkedIn does not let us read your existing post history — that permission is closed to new applications. We can post, but past-post import is unavailable.',
  },
  {
    name: 'TikTok',
    url: 'https://www.tiktok.com/signup',
    accountType: 'Business account',
    required: 'Optional',
    fields: ['Handle (@...)', 'Account email', 'Confirm switched to a Business account'],
    notes: 'Requires TikTok app review before posting works. Allow 1–2 weeks.',
  },
  {
    name: 'YouTube',
    url: 'https://www.youtube.com/create_channel',
    accountType: 'YouTube channel on a Google account',
    required: 'Optional',
    fields: ['Channel name', 'Channel URL', 'Google account email that owns it'],
    notes: 'Requires Google verification for production posting. Allow up to 1 week.',
  },
  {
    name: 'Pinterest',
    url: 'https://www.pinterest.com/business/create/',
    accountType: 'Business account',
    required: 'Optional',
    fields: ['Handle', 'Account email', 'Names of the boards we should post to'],
    notes: 'Requires Pinterest review for write access. Allow 1–2 weeks.',
  },
  {
    name: 'Reddit',
    url: 'https://www.reddit.com/register/',
    accountType: 'Standard account',
    required: 'Optional',
    fields: ['Username', 'Account email', 'Subreddits we should post to'],
    notes: 'Each subreddit has its own posting rules. Tell us which ones you want used.',
  },
  {
    name: 'Threads',
    url: 'https://www.threads.net/',
    accountType: 'Linked to the Instagram account above',
    required: 'Optional',
    fields: ['Handle (@...)', 'Confirm it uses the same Instagram account'],
    notes: 'Threads uses the Instagram account. No separate signup.',
  },
  {
    name: 'Google Business Profile',
    url: 'https://business.google.com/create',
    accountType: 'Verified business listing',
    required: 'Recommended for local businesses',
    fields: [
      'Business name as listed',
      'Business address',
      'Google account email that manages it',
      'Confirm the listing is verified',
    ],
    notes:
      'High value for local businesses — posts and reviews appear directly in Google Search and Maps.',
  },
  {
    name: 'Bluesky',
    url: 'https://bsky.app',
    accountType: 'Standard account',
    required: 'Optional',
    fields: [
      'Handle (e.g. yourbrand.bsky.social)',
      'APP PASSWORD — not your login password',
    ],
    notes:
      'Create an app password at Settings → Privacy and security → App passwords. Never share your main password; an app password can be revoked on its own.',
  },
  {
    name: 'Mastodon',
    url: 'https://joinmastodon.org/servers',
    accountType: 'Account on any Mastodon server',
    required: 'Optional',
    fields: ['Full handle (@you@server.social)', 'Server URL'],
    notes: 'Tell us which server you joined — each one is separate.',
  },
]

const wb = new ExcelJS.Workbook()
wb.creator = 'Fanout.digital'
wb.created = new Date()

// ── Sheet 1: Start Here ─────────────────────────────────────────────────────
const intro = wb.addWorksheet('Start Here', {
  properties: { tabColor: { argb: NAVY } },
  views: [{ showGridLines: false }],
})
intro.columns = [{ width: 4 }, { width: 104 }]

function introRow(text, opts = {}) {
  const r = intro.addRow(['', text])
  const c = r.getCell(2)
  c.font = { name: 'Calibri', size: opts.size ?? 11, bold: !!opts.bold, color: { argb: opts.color ?? NAVY } }
  c.alignment = { wrapText: true, vertical: 'middle' }
  r.height = opts.height ?? (opts.size >= 18 ? 34 : 18)
  return r
}

intro.addRow([])
introRow('Social Media Account Setup', { size: 22, bold: true })
introRow('Everything we need to publish on your behalf', { size: 12, color: 'FF5B6472' })
intro.addRow([])
introRow('What this is for', { size: 13, bold: true })
introRow(
  'We are setting up automated social posting for your business. To do that we need the accounts to exist, and we need to be added to them. This workbook lists exactly what is needed for each platform.',
)
intro.addRow([])
introRow('How to fill it in', { size: 13, bold: true })
introRow('1.  Open the "Accounts" tab.')
introRow('2.  Start with the rows marked Required. The rest are optional — do the ones that matter to your business.')
introRow('3.  Fill in the yellow cells only. Leave anything you are unsure about blank and we will follow up.')
introRow('4.  Send the file back, or tell us and we will walk through it together on a call.')
intro.addRow([])

const warn = introRow(
  'This file will contain passwords. Please handle it carefully: send it back through a method you trust, and once we confirm the accounts are set up, delete your copy. We will store our copy in a password manager and delete the spreadsheet.',
  { bold: true, color: RED, height: 44 },
)
warn.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF3F2' } }
warn.getCell(2).border = boxed

intro.addRow([])
introRow('Why we are asking for logins', { size: 13, bold: true })
introRow(
  'We need them to CREATE and set up the accounts for you. Day-to-day publishing does not use them: once an account exists, you connect it by clicking "sign in with…" on the platform\'s own screen, and that approval is what lets us post. You can revoke it at any time without changing your password.',
)
introRow(
  'If you would rather create the accounts yourself, you can — just leave the password columns blank, fill in the usernames, and we will send you connection links instead.',
  { color: 'FF5B6472' },
)
introRow(
  'One special case: Bluesky uses an APP PASSWORD rather than your real one. Instructions are on that row.',
  { color: 'FF5B6472' },
)

intro.addRow([])
introRow('Timelines to expect', { size: 13, bold: true })
introRow('Facebook, Instagram, Threads, Bluesky, Mastodon, Reddit, X — usable straight away once created.')
introRow('TikTok and Pinterest — 1 to 2 weeks for platform review.')
introRow('YouTube — up to 1 week for Google verification.')
intro.addRow([])
introRow('Questions? Reply to the email this came from and we will help.', { color: 'FF5B6472' })

// ── Sheet 2: Accounts ───────────────────────────────────────────────────────
const ws = wb.addWorksheet('Accounts', {
  properties: { tabColor: { argb: GOLD } },
  views: [{ state: 'frozen', ySplit: 2, showGridLines: false }],
})

ws.columns = [
  { key: 'platform', width: 26 },
  { key: 'required', width: 15 },
  { key: 'accountType', width: 34 },
  { key: 'url', width: 40 },
  { key: 'fields', width: 46 },
  { key: 'answer', width: 38 },
  { key: 'username', width: 28 },
  { key: 'password', width: 28 },
  { key: 'twofa', width: 30 },
  { key: 'status', width: 16 },
  { key: 'notes', width: 62 },
]

const title = ws.addRow(['Account Details — please complete the yellow columns'])
ws.mergeCells(1, 1, 1, 11)
title.getCell(1).font = { name: 'Calibri', size: 15, bold: true, color: { argb: WHITE } }
title.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
title.getCell(1).alignment = { vertical: 'middle', indent: 1 }
title.height = 30

const HEADERS = [
  'Platform',
  'Priority',
  'Account type needed',
  'Where to create it',
  'What we need from you',
  'YOUR ANSWERS  ▼',
  'Username / email  ▼',
  'Password  ▼',
  '2FA / recovery  ▼',
  'Done?',
  'Notes',
]
// Columns 6-9 are client-editable (gold). 7-9 are credentials and are tinted
// differently so it is obvious at a glance which cells are sensitive.
const EDITABLE = new Set([6, 7, 8, 9])
const CREDENTIAL = new Set([7, 8, 9])

const head = ws.addRow(HEADERS)
head.height = 26
head.eachCell((cell, i) => {
  const editable = EDITABLE.has(i)
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: editable ? NAVY : WHITE } }
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: CREDENTIAL.has(i) ? 'FFFFD98A' : editable ? GOLD : NAVY },
  }
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true }
  cell.border = boxed
})

for (const p of PLATFORMS) {
  const row = ws.addRow({
    platform: p.name,
    required: p.required,
    accountType: p.accountType,
    url: p.url,
    fields: p.fields.map((f) => `•  ${f}`).join('\n'),
    answer: '',
    username: '',
    password: '',
    twofa: '',
    status: '',
    notes: p.notes,
  })

  row.height = Math.max(58, p.fields.length * 17)
  row.eachCell({ includeEmpty: true }, (cell, i) => {
    cell.border = boxed
    cell.alignment = { vertical: 'top', wrapText: true, indent: 1 }
    cell.font = { name: 'Calibri', size: 10, color: { argb: NAVY } }
    if (i === 1) cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY } }
    if (i === 2) {
      const req = p.required === 'Required'
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: req ? RED : GREEN } }
    }
    if (CREDENTIAL.has(i)) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2D6' } }
    } else if (EDITABLE.has(i)) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9E3' } }
    } else if (i !== 2) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
    }
  })

  // Bluesky is the one platform where an APP password is the correct answer and
  // the account password is the wrong one. Say so in the cell itself, because
  // this row is where the mistake would actually be made.
  if (p.name === 'Bluesky') {
    row.getCell(8).note =
      'Use an APP PASSWORD, not your account password.\nBluesky: Settings → Privacy and security → App passwords.\nAn app password can be revoked on its own without changing your login.'
  }

  const link = row.getCell(4)
  link.value = { text: p.url, hyperlink: p.url }
  link.font = { name: 'Calibri', size: 10, color: { argb: 'FF1155CC' }, underline: true }

  // Done? is a dropdown rather than free text, so it stays machine-readable.
  row.getCell(7).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"Created,In progress,Not needed"'],
  }
}

ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 11 } }

// ── Sheet 3: Brand Info ─────────────────────────────────────────────────────
const brand = wb.addWorksheet('Brand Info', {
  properties: { tabColor: { argb: 'FF7B4FBF' } },
  views: [{ state: 'frozen', ySplit: 2, showGridLines: false }],
})
brand.columns = [{ key: 'q', width: 46 }, { key: 'a', width: 66 }, { key: 'why', width: 56 }]

const bTitle = brand.addRow(['Brand Information — helps us write posts that sound like you'])
brand.mergeCells(1, 1, 1, 3)
bTitle.getCell(1).font = { name: 'Calibri', size: 15, bold: true, color: { argb: WHITE } }
bTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
bTitle.getCell(1).alignment = { vertical: 'middle', indent: 1 }
bTitle.height = 30

const bHead = brand.addRow(['Question', 'YOUR ANSWER  ▼', 'Why we ask'])
bHead.height = 24
bHead.eachCell((cell, i) => {
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: i === 2 ? NAVY : WHITE } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i === 2 ? GOLD : NAVY } }
  cell.alignment = { vertical: 'middle', indent: 1 }
  cell.border = boxed
})

const BRAND_QS = [
  ['Business name as it should appear publicly', 'Used as the account name on every platform.'],
  ['One sentence describing what you do', 'Becomes the bio on each profile.'],
  ['Website URL', 'Linked from every profile.'],
  ['Contact email for the accounts', 'Platforms require one, and send security alerts there.'],
  ['Contact phone (if you want it public)', 'Some platforms display it; leave blank to omit.'],
  ['Who are your customers?', 'Shapes who the posts are written for.'],
  ['Three words describing your tone', 'e.g. friendly, expert, straightforward.'],
  ['Anything we must NEVER say', 'Claims, competitors, or topics to avoid.'],
  ['Do you have a logo file?', 'Used as the profile picture. Send separately.'],
  ['Do you have brand colours?', 'Used in generated images.'],
  ['Existing social accounts we should use instead of creating new', 'Avoids splitting your audience.'],
  ['How often would you like to post?', 'Sets the publishing schedule.'],
]

for (const [q, why] of BRAND_QS) {
  const r = brand.addRow({ q, a: '', why })
  r.height = 30
  r.eachCell({ includeEmpty: true }, (cell, i) => {
    cell.border = boxed
    cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
    cell.font = { name: 'Calibri', size: 10, color: { argb: i === 3 ? 'FF5B6472' : NAVY } }
    if (i === 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9E3' } }
    else cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
  })
}

const out = path.join(process.cwd(), 'docs', 'Client-Social-Media-Setup-Template.xlsx')
await wb.xlsx.writeFile(out)
console.log(`Wrote ${out}`)
console.log(`Sheets: Start Here, Accounts (${PLATFORMS.length} platforms), Brand Info (${BRAND_QS.length} questions)`)
