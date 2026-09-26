# Docent

Docent turns directions into a short animated route. A host picks a start and a destination, splits the trip into
legs by how people really travel (walk, boda, matatu, car or bicycle), adds landmarks, and sends one link. The person
who opens the link watches the route play step by step, with the landmarks at each turn.

It is built for Kenya first: cheap phones, slow data, and estates where the map pin is not enough.

## How it works

- **No accounts and no database in this version.** The whole route is packed into the share link (`/r?d=...`). The
  route is shortened with Google polyline encoding, compressed with DEFLATE and written as URL safe base64. A 5 km
  route with three legs, 10 landmarks and 20 steps comes to about 1,200 to 1,500 characters.
- **The link is untrusted input.** `decodeDoc` in `src/lib/share.ts` checks every field, caps the sizes (20 legs,
  20,000 points, 60 landmarks, 200 steps), clamps long text and recomputes distance and time. A bad link shows a
  friendly "this link is broken" page.
- **Landmarks come from the map tiles.** `src/lib/landmarks.ts` reads the points of interest layer of the
  OpenFreeMap vector tiles along the route (fuel stations, churches, mosques, schools, hospitals, stages, banks,
  pharmacies, shops, places to eat). It never invents a landmark. In estates where OpenStreetMap is thin you may get
  few or none, and the host adds their own.
- **Steps are written from the route.** `src/lib/steps.ts` finds turns on walk, car and bicycle legs, names the
  nearest landmark at each turn ("Turn left at Total petrol station"), and writes one plain step for each matatu or
  boda ride, with where to board, how far to ride and where to get off.
- **Share previews.** `/api/og` draws the route and title as a 1200 x 630 image for WhatsApp and social apps.
  Route pages are unlisted: they ask search engines not to index them.

## Run it

You need Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
npm run verify     # types, lint, tests and a production build
```

`npm test` runs the unit tests only.

## Environment variables

Set these in `.env.local` for local work and in the Vercel project settings for deploys. Both are optional.

| Name | What it is for |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | The public address of the site, for example `https://docent.example`. Used for absolute links in share previews. Defaults to `http://localhost:3000`. Changing it needs a redeploy. |
| `ORS_API_KEY` | Key for OpenRouteService. The routing and search proxy uses it when it is set. |

## Free services and their limits

All figures were checked on 2026-09-26 on the vendors' own pages. Check again before any money decision.

| Service | Free limit | What it means for Docent |
|---|---|---|
| Vercel Hobby | 100 GB transfer, 1M function calls, 4 h active CPU a month. Non-commercial use only | Fine for the beta. Move to Pro ($20 a month) the day Docent earns money |
| OpenRouteService | Directions 2,000 a day (40 a minute), geocoding 3,000 a day. Attribution required, no personal data | Only hosts use routing. Viewers never do, because the route is in the link |
| OpenFreeMap tiles | No key, no stated limits, may stop without notice | The tile address lives in one place (`src/lib/map.ts`) so it can be switched |
| Photon search | Fair use, heavy use gets throttled | Search as you type, with a pause before each request and a cache |

Supabase is planned for accounts and saved routes in a later version. It is not used yet.

## Attribution

Map data and tiles must always be credited wherever a map or a map image is shown:
"Map data © OpenStreetMap contributors, tiles by OpenFreeMap", plus OpenRouteService where its routes are used.
The map shows this in its corner and the home page shows it in the footer. Do not hide or remove it.
