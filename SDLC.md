# Docent: Software Development Life Cycle

Owner: Tim Mwangi. Status: draft v0.1, 2026-09-26. Companion to `PRD.md`.

Team: Tim plus Claude Code (Opus 5.5). Budget: free tiers. Timings are estimates for part-time work.

## Overview

| Phase | What | Output | Estimate |
|---|---|---|---|
| 0 Validate | Talk to real hosts and viewers before building | Go or no-go, top 3 use cases | 1 week |
| 1 Design | Flows, screens, prop style, device list | Clickable prototype, design system | 1 week |
| 2 Build v1 | Plan mode in 6 milestones | Working app on a preview link | 4 weeks |
| 3 Test | Automated tests, real devices, security review | Test report, fixes | 1 week |
| 4 Beta | 20 to 50 real users | Feedback, metrics | 2 weeks |
| 5 Operate | Monitor, fix, keep costs at zero | Weekly health check | Ongoing |
| 6 Iterate | v1.1, v2 indoor, v3 record, v4 AI | Each release repeats phases 1 to 5 | Per release |

About 9 weeks to a public beta of v1.

## Phase 0: Validate

- Talk to 10 people: 3 hosts who give directions often, 2 Airbnb or guest house hosts, 2 event organisers,
  1 estate agent, 2 delivery riders or drivers who receive bad directions.
- Ask how they give and get directions today (voice notes, pins, calls), what goes wrong, and what the last
  500 metres looks like.
- Show a paper or Figma mock of the playback and ask: "Would you send this instead of a voice note?"
- Quick scan of what exists: Google Maps sharing, what3words, indoor tools (Mappedin and similar).
- **Go if** at least 6 of 10 say they would use it, and at least 2 would pay for a business version.

## Phase 1: Design

- User flows: create (A, B, mode, edit, landmarks, steps, arrival, publish) and view (open, play, end card).
- Wireframes at 360 px first, then tablet and desktop.
- Design system and visual direction using the `design-taste` skill: colours, type, map style, button sizes.
- Prop style sheet: low-poly stick walker (man, woman, neutral), boda, car, matatu, bicycle, in 3D and 2D.
- Map style: a calm custom style on OpenFreeMap tiles so routes and props stand out.
- Device test list (below) agreed before building.
- **Exit:** clickable prototype that 3 of the Phase 0 people can use without help.

## Phase 2: Build v1

Each milestone ends in a working preview link Tim can open on his phone.

| Milestone | Scope | Done when |
|---|---|---|
| M1 Foundation | Next.js 16 app, Supabase project, the three SQL files, magic link sign-in, Vercel project, verify gate script | Sign in works on the preview link |
| M2 Map and routing | MapLibre map, search, A and B, routing proxy with cache and rate limit, modes, drag, via points, freehand, segments, undo | A multimodal route can be built on a phone |
| M3 Landmarks and steps | POI lookup from tiles, keep or hide, host pins with compressed photos, step generator, step editor, arrival card | Steps read well on 5 real Nairobi routes |
| M4 Playback | Animation engine (time compression, speeds per mode), Basic and 2D tiers, then 3D tier with code-built props, mode change transitions, tier auto-detect, reduce motion | Plays smoothly on the low-end test phone |
| M5 Share | Publish, slugs, PIN, expiry, preview image, share page, dashboard, delete, report, offline cache | A link sent on WhatsApp shows a preview and plays signed out |
| M6 Hardening | Performance budgets, accessibility pass, error states, empty states, rate limits, quota alerts | All budgets in PRD section 7 met |

### Working rules

- Local git from day one. Work lands on `main`; no pull requests.
- Before every push, the verify gate must pass: `tsc --noEmit`, lint, `vitest run`, `next build`.
- Preview builds for phone testing with `vercel deploy` (not production). Pushing `main` deploys production, so every
  push is confirmed with Tim first.
- Database: exactly three SQL files (`supabase/schema.sql`, `supabase/seed.sql`, `supabase/changes.sql`). Tim runs
  SQL himself in the Supabase SQL editor. Code tolerates a missing column until the SQL is run.
- Tests never touch the live database; they use a local Postgres (PGlite).
- Secrets live in env vars, checked by name only, never printed.
- All user-facing text lives in one strings file (Swahili comes in v1.1).
- No em or en dashes in copy.

## Phase 3: Test

| Layer | What | Tool |
|---|---|---|
| Unit | Geometry (distance along route, bearings, turn detection), step generator, time compression, tier picker, PIN check | Vitest |
| Database | RLS: a stranger cannot edit or read a PIN route; expired routes are hidden | Vitest on PGlite |
| End to end | Create, publish, open signed out, PIN, expiry, delete | Playwright |
| Visual | Every screen from 320 to 1920 px | `kazi:visual-qa` |
| Security | RLS, API route auth, rate limits, headers, upload checks | `kazi:reviewer` |
| Performance | Load time and data use on throttled 3G and 4G; frame rate per tier | Chrome DevTools, Lighthouse |
| Real devices | See the list below | By hand, every milestone from M4 |

Device list
- Low-end Android: 2 GB RAM, Android 9 to 11, Chrome (the most important one)
- Mid-range Android: 4 GB RAM, recent Chrome
- iPhone on current iOS Safari, plus one older iPhone
- Laptop: Chrome, Safari, Firefox

**Exit:** no open bugs that block creating, sharing or playing a route; budgets met on the low-end phone.

## Phase 4: Beta

- Invite 20 to 50 people from Phase 0 and Tim's network (hosts, event organisers, Airbnb hosts).
- In-app feedback button and the "Did you find it?" question on the end card.
- Weekly review of the PRD section 11 metrics, top complaints and free tier usage.
- **Exit:** metrics trending toward targets, no data or safety incidents, a clear v1.1 list.

## Phase 5: Operate

- Weekly health check: errors in Vercel logs, routing and search quota used, Supabase size and egress, reports queue.
- Alerts at 70% of any free quota.
- Weekly export of the routes table (the free plan has no point-in-time restore).
- Takedown of reported routes within 24 hours.
- Upgrade triggers: first paying customer (Vercel Pro), steady daily use (Supabase Pro to stop idle pauses), routing
  quota regularly above 70% (paid routing plan or self-hosted routing).

## Phase 6: Iterate

| Release | Key work | Special testing |
|---|---|---|
| v1.1 | Swahili strings, video export of playback, "Did you find it?" | Video export on Android and iPhone |
| v2 Indoor | Room sketch editor, floors, stairs and lifts, doll-house 3D view, same route format with local coordinates | Editor usability on phones |
| v3 Record | Record video while logging GPS or motion sensors, landmark tap saves a frame and voice note, video stays on the device, GPS track cleanup | Real walks in estates and indoors; iPhone sensor permissions |
| v4 AI | Claude suggests landmarks from saved frames and polishes steps; monthly spend cap in code and on the API key | Accuracy on 20 real routes; cost per route |

Each release goes through Design, Build, Test, Beta (a short one) and Operate again.

## Definition of done (every feature)

- Works on the low-end Android and on iPhone Safari.
- Unit tests for its rules, including abuse cases.
- Verify gate green.
- Visual QA passed from 320 to 1920 px.
- Strings in the strings file, no dashes in copy.
- Any SQL is in `changes.sql` with a clear section header, and Tim knows when to run it.
- Live on production and checked signed out.
