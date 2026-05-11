# See Skill M v2.0 for pre-build gates: 35d663704e4081a78514c99bb6716c54

## SKILL M v2.0 — PRE-BUILD GATES (operative 2026-05-11)

### LAYER 1 — BEFORE TOUCHING CODE

STEP 1 — PRE-BUILD PURPOSE CHECK
Before touching any file, answer:
"What does a real user do after this ships?"
- Can name a specific user action → log one line to dispatch page:
  "Layer 1 check: PASS — [user action named]. Building."
- Cannot name a user action → file HALT to CA inbox. Do not touch code.

STEP 2 — DONE LOOKS LIKE FEASIBILITY
Can CC complete the DONE LOOKS LIKE in this session?
- Yes → proceed
- No → file HALT to CA inbox before touching code

### LAYER 2 — BEFORE FILING CLAIMED_DONE

STEP 3 — EVAL GATE (all must pass)
- FILE_EXISTS: target files present in repo
- HTTP_200: affected routes return 200
- SMOKE_PASS: Skill B (Vercel Deploy Verifier) — run vercel_deployment_status
- ENV_SET: any new env vars confirmed in Doppler
- DB_TABLE: any new tables exist and are accessible

STEP 4 — DONE LOOKS LIKE TEST
Can CC demonstrate the outcome as a user action right now?
- Yes → file CLAIMED_DONE with git log -1 --oneline included
- No → do not file. Partial work stays in progress.

STEP 5 — POST-PUSH SHA VERIFICATION (locked 2026-05-11)
After every git commit: git push + git ls-remote to confirm SHA
exists on remote before filing CLAIMED_DONE.
No exceptions. F-01 pattern (fabricated remote state) is real.

### HALT RECOVERY
HALT page → CA inbox (tagged FOR: CA).
CA clears by updating HALT page RE-ENTRY CONDITIONS field to CLEARED.
CC reads this field at next session start — not from chat.

## REPO IDENTITY
ENGINE_NAME=fanout
DOPPLER_PROJECT=fanout
GLOBAL_HUB_PAGE_ID=338663704e40814aaa92fd7293923e4f
LAST_UPDATED=2026-04-16

## UI Design Standard

Before building any frontend component, page, or artifact:

1. **Commit to an aesthetic direction first** (luxury/refined, editorial, industrial, brutalist, retro-futuristic, etc.) — never default to generic
2. **Typography**: Use distinctive Google Fonts pairings — never Inter, Roboto, Arial, or system fonts. Pair a display serif with a clean body font.
3. **Color**: CSS variables for all colors. Dominant color + sharp accent. Never purple gradients on white backgrounds.
4. **Motion**: Staggered load animations (animation-delay cascading). Hover states that surprise. CSS-only preferred for HTML.
5. **Atmosphere**: Gradient meshes, grain textures, dramatic shadows, layered transparencies — never flat solid backgrounds.
6. **Layout**: Asymmetry, overlap, grid-breaking elements. Generous negative space OR controlled density — never safe centered columns.

**Every design must be context-specific and unforgettable. No two builds should look the same.**

Color system for Accrefi/NuStack work:
- Navy: #0A1628
- Gold: #F5C842  
- Purple: #7B4FBF (fixed/subscription tools)
- Blue: #2563EB (usage-based tools)
- Green: #16A34A (free/per-transaction tools)
- Gold chips: NuStack-built tools
