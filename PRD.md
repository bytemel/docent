# Docent: Product Requirements Document

Working name: Docent. Owner: Tim Mwangi. Status: draft v0.1, 2026-09-26.

## 1. Summary

Docent turns "how do I get to your place?" into a short animated route anyone can open from a link. The owner
picks point A and point B, shapes the route the way they actually go, adds landmarks, and chooses how each part is
travelled (walk, boda, matatu, car, bike). The viewer presses play and watches a little stick figure or vehicle move
along the route with clear steps and landmark photos. It works on cheap phones and on slow data.

Later versions add indoor routes (room A to room B), recording a route by walking it, and AI help with landmarks.

## 2. Problem

- Directions in Kenya are given by voice notes, long WhatsApp texts and a dropped pin. A pin gets you to the
  area, not to the gate. The last 500 metres (estates, unnamed roads, "turn at the kiosk") is where people get lost.
- Google Maps does not know local landmarks like "the blue gate" or "the mama mboga shed", and it cannot show
  "walk to the stage, take a matatu, then a boda".
- Indoors (big offices, hospitals, campuses, apartment blocks) there is nothing simple at all.
- Video walkthroughs help but are long, heavy on data and hard to follow.

## 3. Users and use cases

| User | Use case |
|---|---|
| Host (main user) | "Here is how to get to my house from the main road." Sends one link instead of five voice notes. |
| Airbnb and guest house hosts | A link in the booking message so guests arrive without calling. |
| Event organisers (weddings, church, meetups) | One route per venue, shared with every guest. |
| Estate agents and landlords | Show how to reach a property, and later how to walk through it. |
| Businesses in hard-to-find places | A "find us" link on WhatsApp Business and Google profile. |
| Offices, hospitals, campuses (v2) | Indoor routes: reception to room 204, gate to the ward. |
| Viewer | Opens the link, watches 30 to 60 seconds, arrives. No app install, no account. |

## 4. Goals and non-goals

Goals
- A host creates and shares a route in under 3 minutes on a phone.
- A viewer understands the route in one play on a low-end Android over 3G.
- Runs on free tiers until there is real traction.

Non-goals (for now)
- Live turn-by-turn navigation with voice and rerouting. Google Maps already does that; Docent explains the route
  beforehand and hands off to Google Maps for the drive if needed.
- Photo-real 3D or 3D scanning of places.
- Real-time public transport data or fares.
- A native app. It is a web app that can be installed to the home screen (PWA).

## 5. Release plan

| Release | Scope | Why this order |
|---|---|---|
| v1 Plan mode (outdoor) | Pick A and B, route by mode, edit route, landmarks from map plus own pins, auto steps, animated playback with walker and vehicle props, share link | Easiest to build, no sensors or AI, already useful |
| v1.1 | Swahili, export playback as a short video for WhatsApp Status, "Did you find it?" feedback | Cheap wins that help sharing |
| v2 Indoor | Room sketch editor, floors, stairs and lifts, doll-house 3D view | Second big use case, still no sensors |
| v3 Record mode | Walk the route while the app records GPS (outdoor) or motion sensors (indoor), tap to save a landmark with a frame and voice note | The original idea, built on the same route format |
| v4 AI assist | Claude suggests landmarks from saved frames, cleans up steps, translates | Only once people show they want it |

## 6. v1 requirements

### 6.1 Create a route

| ID | Requirement | Acceptance |
|---|---|---|
| C1 | Set A and B by search, tapping the map, or "use my location" | All three work on phone and laptop |
| C2 | Choose a travel mode per segment: walk, boda, car, matatu or bus, bicycle | Route recalculates with the matching routing profile (boda, matatu use the car profile) |
| C3 | Suggested route appears within 2 seconds on 4G | Measured on a mid-range Android |
| C4 | Edit the route: drag the line, add via points, or draw freehand | Freehand snaps to roads when close, stays as drawn when not (footpaths, shortcuts) |
| C5 | Multimodal routes: split into segments, each with its own mode | Example: walk 300 m to the stage, matatu 4 km, boda 1 km |
| C6 | Transfer points get a label ("Board matatu at Kangemi stage") | Shown as a pin and a step |
| C7 | Undo and redo for every edit | At least 20 steps back |
| C8 | Drafts autosave on the device before sign-in | Closing the tab does not lose work |

### 6.2 Landmarks and steps

| ID | Requirement | Acceptance |
|---|---|---|
| L1 | Map landmarks near the route are found automatically (fuel stations, schools, churches, mosques, shops, banks, pharmacies, hospitals, bus stops) | Read from the map tiles already loaded, no extra calls |
| L2 | The host keeps or hides each suggested landmark | Hidden ones never show to viewers |
| L3 | The host adds own pins: label, optional photo, optional note | Photo compressed on the device to about 100 KB before upload |
| L4 | Steps are generated from the route: each turn, each mode change, the nearest landmark to each turn | "Turn left at Total petrol station" style, in plain English |
| L5 | The host can edit, reorder and delete steps | Edits survive route changes where the step still applies |
| L6 | Arrival card: a final photo of the gate or door, plus a note ("Green gate, ring the bell") | Shown at the end of playback |

### 6.3 Playback

| ID | Requirement | Acceptance |
|---|---|---|
| P1 | Play, pause, scrub, and speed 1x, 2x, 4x | Scrubbing jumps the traveller and the step list together |
| P2 | Playback is time-compressed to 20 to 60 seconds total, whatever the real distance | Real distance and estimated real time shown beside it |
| P3 | Travellers (props): walker (man, woman or neutral stick figure), boda, car, matatu or bus, bicycle | The prop changes at each mode change |
| P4 | Mode changes are animated: the walker walks into the matatu, the matatu stops, the walker steps out | A short (under 1 second) transition, skipped at 4x |
| P5 | Props face the direction of travel and move at speeds that feel right per mode | Walk slow, boda fast, matatu pauses at the transfer stop |
| P6 | Three render tiers: 3D (tilted map, low-poly props built in code), 2D (flat animated icons), Basic (dot) | Picked automatically, the viewer can switch |
| P7 | Tier auto-detect: WebGL support, device memory and core count where available, plus a 2 second frame-rate check that downgrades if it drops below 30 fps | A 2 GB RAM Android never stutters; it gets 2D or Basic |
| P8 | Camera follows the traveller in 3D; overview in 2D and Basic | "Show whole route" button always visible |
| P9 | Step list syncs with playback; tapping a step jumps there | Current step highlighted and read by screen readers |
| P10 | Respects "reduce motion": no camera swoops, simple dot, step list first | Honoured from the OS setting |
| P11 | End card: arrival photo and note, "Open in Google Maps" for the destination, "Replay" | Google Maps link opens the app on phones |

### 6.4 Save and share

| ID | Requirement | Acceptance |
|---|---|---|
| S1 | Sign in by email magic link to publish | Viewing never needs an account |
| S2 | Publish gives a short link that is hard to guess | Links are unlisted and never appear in search |
| S3 | WhatsApp and social preview: title plus a route image | The image is a snapshot of the map taken on the device at publish time |
| S4 | Optional PIN to open a route | PIN checked on the server, stored hashed |
| S5 | Optional expiry (for events) | Expired links show a polite "this route has expired" page |
| S6 | Edit after publish keeps the same link | Viewers always see the latest version |
| S7 | Delete a route, including its photos | Gone for viewers immediately |
| S8 | Viewer can report a route | Report reaches the admin list |
| S9 | Offline replay: once opened, the route and its map area are cached | Replays with no data, for example in a basement or a matatu |

### 6.5 Host dashboard

- List of my routes with views count, edit, duplicate, share, delete.
- Duplicate lets an event organiser make "from Westlands" and "from CBD" versions fast.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Devices | Works on Android Chrome (Android 9 and up, 2 GB RAM), iPhone Safari (last 3 iOS versions), desktop Chrome, Firefox, Safari, Edge |
| Performance | Viewer page usable in under 3 s on 4G and under 6 s on 3G (mid-range Android). The app code for the viewer under 250 KB gzipped before the map library; the 3D code loads only when the 3D tier is used |
| Data use | Opening and playing one route uses under 2 MB on first view |
| Layout | Works from 320 px to 1920 px wide, no sideways scrolling, thumb-reachable controls |
| Accessibility | WCAG 2.2 AA; the step list is the accessible version of the animation |
| Languages | English in v1, Swahili in v1.1; all text in one strings file from day one |
| Privacy | Routes point at homes, so: unlisted links by default, no public directory, no viewer tracking beyond a view count, easy delete, consent note at publish. Follows the Kenya Data Protection Act 2019 |
| Security | Row level security: only the owner can change a route; public reads go through one server function that checks visibility, PIN and expiry. Routing and search calls go through our server with per-IP rate limits so nobody can burn the free quotas |
| Cost | Stays on free tiers in v1; hard caps on every metered service (see section 10) |

## 8. Data model (v1)

One route is one JSON document, so the viewer loads it in a single read.

```
routes
  id, owner_id, slug, title, visibility (unlisted | pin), pin_hash, expires_at,
  doc (jsonb), preview_image_path, views, created_at, updated_at

doc = {
  version: 1,
  segments: [ { mode: "walk" | "boda" | "car" | "matatu" | "bike", geometry: GeoJSON LineString,
                distance_m, est_seconds, from_label, to_label } ],
  landmarks: [ { id, lng, lat, label, source: "map" | "host", kind, photo_path, note, hidden } ],
  steps: [ { id, text, at_m, landmark_id, edited } ],
  arrival: { photo_path, note },
  traveller: { walker: "man" | "woman" | "neutral" }
}

reports: id, route_id, reason, created_at
```

Photos live in one Supabase Storage bucket, public read by unguessable path, owner-only write.

## 9. Architecture and stack

| Part | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router), TypeScript, Tailwind v4 | Tim's standard stack |
| Hosting | Vercel | Free to start, deploys on push to main |
| Database, auth, files | Supabase (Postgres, magic link auth, Storage) | Free tier, RLS |
| Map | MapLibre GL JS with OpenFreeMap vector tiles | Free, no API key, tiles include points of interest |
| Routing | OpenRouteService, called through our own API route and cached by route hash; only coordinates are sent, never names | Free for everyone, walking, car and cycling profiles |
| Search | Photon for search as you type, OpenRouteService geocoding as backup, both through our API route | Free; see section 10 for limits |
| Geometry | Turf.js (bearing, distance along line, nearest point, simplify) | Small, runs in the browser |
| 3D props | three.js as a MapLibre custom layer, props built from simple shapes in code, lazy loaded | No model files to download; runs on mid-range phones |
| 2D props | SVG sprites with a short walk cycle | Light for low-end phones |
| Email | Supabase auth email through Resend free tier | Magic links |

Flow: the browser does the heavy work (geometry, landmark lookup, animation, image compression, preview image).
The server only proxies routing and search, stores the route JSON and photos, and serves the share page.

## 10. Running costs

All figures checked 2026-09-26 on the vendors' own pages. Re-check before any money decision.

### Free tier limits that matter

| Service | Free limit | What it means for Docent | Source |
|---|---|---|---|
| Vercel Hobby | 100 GB transfer, 1M function calls, 4 h active CPU a month. **Non-commercial use only** | Fine for the beta. The day Docent charges money, move to Pro ($20 a month) | vercel.com/docs/limits/fair-use-guidelines |
| Supabase Free | 500 MB database, 1 GB file storage, **5 GB egress**, 50,000 auth users, pauses after 1 week idle, 2 free projects | Egress is the first limit we will hit (see below) | supabase.com/pricing |
| OpenRouteService | Directions 2,000 a day (40 a minute), geocoding 3,000 a day. Free for everyone, attribution required, do not send personal data | Viewers never call routing (the route is saved), so only hosts use it | account.heigit.org/info/plans |
| OpenFreeMap tiles | No key, no stated limits, may stop without notice | Keep the tile URL in one config value so we can switch to self-hosted tiles | openfreemap.org |
| Photon search | Fair use, heavy use gets throttled, no numbers published | Use for search as you type, with debounce and cache; ORS geocoding as backup | photon.komoot.io |

Not usable:
- **GraphHopper Free** is non-commercial and has no map matching (500 credits a day). Its cheapest commercial plan is
  69 EUR a month. So the backup router is a self-hosted OSRM or Valhalla later, not GraphHopper Free.
- **Nominatim** forbids search-as-you-type and allows at most 1 request a second. Only for one-off lookups.
- **Google Places** data cannot be shown on a non-Google map (Maps Service Terms 14.2).
- **Digital Matatus** Nairobi data ended in 2020 and has no open licence. Hosts draw matatu segments themselves.

### Capacity on free tiers (estimates)

| Limit | Arithmetic | Roughly supports |
|---|---|---|
| ORS directions, 2,000 a day | About 10 routing calls to build and edit one route, fewer with the cache | About 200 new routes a day |
| Supabase storage, 1 GB | About 5 photos at 100 KB plus a 60 KB preview image = about 0.56 MB per route | About 1,800 routes |
| Supabase egress, 5 GB a month | One view loads the route JSON (about 20 KB) plus photos (up to 0.5 MB) = about 0.5 MB | About 10,000 views a month |
| Vercel transfer, 100 GB a month | About 1 MB of app code and page per first view | About 100,000 views a month |

Ways to push the egress limit out: load photos only when their step is reached, 60 KB photos instead of 100 KB,
long cache headers so repeat views cost nothing. After that, move photos to a storage service with free egress, or
go to Supabase Pro.

### When it starts costing money

| Trigger | Upgrade | Cost |
|---|---|---|
| First paying customer or ads | Vercel Pro | $20 a month (includes $20 of usage) |
| Over about 10,000 views a month, or idle pauses hurt | Supabase Pro (250 GB egress, 100 GB storage, no pause) | $25 a month |
| Routing regularly over 70% of 2,000 a day | Self-hosted OSRM or Valhalla for Kenya, or a paid routing plan | Depends on option; decide then |
| v4 AI assist | Claude API per route, with a monthly cap in code and on the key | See below |

### v4 AI cost per route (estimate)

About 30 frames at 512 x 384 px. Image tokens are about width x height / 750, so about 260 tokens a frame.
30 frames = about 7,900 tokens, plus about 1,500 tokens of instructions = about 9,500 input tokens. About 1,500
output tokens.

| Model | Price per million tokens (in / out) | Per route |
|---|---|---|
| Claude Haiku 4.5 | $1 / $5 | 9,500 x $1/M + 1,500 x $5/M = $0.0095 + $0.0075 = **about $0.02** |
| Claude Opus 5.5 | $4 / $20 | 9,500 x $4/M + 1,500 x $20/M = $0.038 + $0.030 = **about $0.07** |

Haiku 4.5 is the default for landmark suggestions. The model name lives in an env var.

### Legal notes (not legal advice)

- A home location is personal data under the Kenya Data Protection Act 2019 (location data is named in s.2).
  Docent asks for explicit consent at publish, explains who can see the route, and makes deleting easy.
- Small operators (under KES 5M revenue and under 10 staff) are exempt from ODPC registration, except for listed
  sectors that include "transport services firms". Docent is probably not one, but a Kenyan lawyer should confirm
  before launch.
- Attribution is required for OpenStreetMap, OpenMapTiles and OpenRouteService. It is shown on the map.

## 11. Success metrics

| Metric | Target at 3 months after beta |
|---|---|
| Time to create and share a first route | Median under 3 minutes |
| Share links opened per published route | Over 3 |
| Playback completion (viewer reaches the end card) | Over 70% |
| "Did you find it?" yes rate (v1.1) | Over 85% |
| Hosts who make a second route | Over 30% |
| Monthly cost | KES 0 until 1,000 routes a month |

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| OpenStreetMap is thin in estates and small roads | Fewer automatic landmarks, some roads missing | Host pins and freehand drawing cover the gap |
| Free tier limits (routing, hosting) | Service stops at a busy moment | Cache every route calculation, rate limit per IP, backup routing provider, alert at 70% of quota |
| Vercel Hobby is non-commercial | Must move to Pro once it earns money | Budget $20 a month from the first paying customer |
| Supabase egress (5 GB a month) runs out first | Photos stop loading around 10,000 views a month | Lazy photos, small images, cache headers, then Pro |
| OpenFreeMap can stop without notice | Maps go blank | Tile URL in one setting; fallback to self-hosted Kenya tiles |
| Supabase free projects pause when idle | App down for the first visitor after a quiet week | Keep-alive ping, or move to Pro at launch |
| 3D too heavy on cheap phones | Stutter, bad first impression | Tier auto-detect with 2D and dot fallbacks; test on a real 2 GB phone |
| Misuse: sharing someone else's home location | Safety harm | Unlisted by default, report button, fast takedown, terms of use |
| iOS Safari quirks (WebGL memory, video export) | Crashes or missing features on iPhone | Test on real iPhones every milestone; video export only where supported |

## 13. Open questions

1. Final name. "Docent" is a working name; something local and easy to say might travel better on WhatsApp.
2. Business model: free for personal routes, paid for businesses (branding, many routes, indoor floors, analytics)?
   Paystack with M-Pesa when it comes.
3. Default walker: neutral stick figure, with man and woman as choices?
4. Viewer comments? For example "the kiosk has moved".
5. Do we need an in-app way for the host to confirm a route is still accurate (for example every 6 months)?

Answered by research: matatu segments are drawn by the host, because the Digital Matatus data ended in 2020 and
has no open licence.

## Sources (checked 2026-09-26)

- Vercel: vercel.com/docs/limits/fair-use-guidelines, vercel.com/docs/plans/pro-plan
- Supabase: supabase.com/pricing
- OpenRouteService: account.heigit.org/info/plans, account.heigit.org/info/tos
- GraphHopper: graphhopper.com/pricing
- OpenFreeMap: openfreemap.org, openfreemap.org/tos; POI layer: github.com/openmaptiles/openmaptiles (layers/poi)
- Nominatim: operations.osmfoundation.org/policies/nominatim
- Photon: photon.komoot.io
- Google Maps terms: cloud.google.com/maps-platform/terms/maps-service-terms
- Claude pricing: platform.claude.com/docs/en/about-claude/pricing
- Digital Matatus: digitalmatatus.com/map.html, mobilitydatabase.org/feeds/gtfs/mdb-1815
- Kenya Data Protection Act 2019 and 2021 registration regulations: new.kenyalaw.org
