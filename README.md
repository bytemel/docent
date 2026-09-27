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

## Live sharing

A guest who is watching a route can share where they are with the host while they travel. The host opens a watch
page (`/live/<id>?d=...`) and sees the guest's dot move along the route, with the distance left and a rough time to
arrive. The dot is snapped onto the route when it is close, and a short trail shows the last two minutes.

How it works:

- **No tables and no storage.** Positions go straight from the guest's phone to the host's browser through Supabase
  Realtime Broadcast. Nothing is written to a database, so Docent does not store locations.
- **The link is the key.** Each share gets a new random id of 24 characters (`src/lib/live.ts`). Only people who
  have the watch link can join that channel, so share the link only with people you trust.
- **Light on data.** The guest's phone sends at most one position every 3 seconds, or sooner after moving more than
  20 m, plus a small "still here" signal every 15 seconds. The watch page says "Last seen 2 min ago" when the
  signals stop, and "Sharing stopped" when the guest turns it off.
- **Jitter is smoothed.** `src/lib/liveFilter.ts` drops positions that are worse than 100 m or that jump faster than
  60 m/s, and smooths the rest, trusting the more accurate readings more.

Live sharing is optional. Without the two variables below, the rest of Docent works as before and the watch page
says "Live sharing is not switched on for this site yet."

| Name | What it is for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The address of your Supabase project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The public anon key of that project. It is safe in the browser: Docent only uses it for Realtime Broadcast. |

To switch it on:

1. Create a free project at supabase.com.
2. Open Project Settings, then API. Copy the Project URL and the anon public key.
3. Add them as the two variables above in `.env.local` and in the Vercel project settings, then redeploy. Both are
   built into the page at build time, so a change needs a new deploy.

No SQL is needed. Realtime Broadcast works on a new project without any tables or policies.

## Mobile app

The Android and iOS app lives in `mobile/`. It is a Capacitor shell around the same website: the app opens
`https://docent-drab.vercel.app`, so every web deploy updates the app too, with no app store release. The app adds what
a browser cannot do:

- **Location with the screen off.** During directions the app keeps tracking through a foreground service, with a
  "Docent directions" notification while it runs. The web version stops when the screen locks.
- **The phone's own voice** for spoken directions, which keeps talking with the screen off.
- **Screen stays awake** while navigating, a light tap on each spoken turn, and the phone's share sheet for live links.
- **Back button, status bar, splash screen**, and links to `/r`, `/go`, `/here` and `/live/...` (or `docent://...`)
  open in the app.

The website talks to these through `src/lib/native.ts`, which uses the bridge Capacitor puts in the page
(`window.Capacitor`). In a normal browser that bridge is missing, so the site falls back to the web APIs. The web
bundle has no Capacitor packages in it.

If the phone is offline when the app starts, it shows `mobile/www/offline.html` with a Try again button.

### Get the Android app

GitHub Actions builds the app on every push to `main` that changes `mobile/` or the workflow, and on demand from the
Actions tab (the "Android" workflow, then Run workflow). Nothing needs Java or the Android SDK on your computer.

- **Releases:** open the repository's Releases page and pick "Docent for Android (latest build)". The APK is
  attached as `docent-android-debug.apk`. Each build replaces the previous one.
- **Actions:** open the latest "Android" run and download the `docent-android-debug` artifact (a zip with the APK).

To install on an Android phone: download the APK on the phone and open it. The first time, Android asks you to allow
installs from your browser or file manager. Allow it for that app only, then open the APK again. When directions start,
allow location "while using the app" and allow notifications, so the directions notification can show.

### Build it on a Mac

You need JDK 21 and the Android SDK.

```bash
cd mobile
npm ci
npx cap sync android
cd android && ./gradlew assembleDebug     # app/build/outputs/apk/debug/app-debug.apk
```

`npm run icons` in `mobile/` redraws the app icons and splash screens from the Docent mark.

### Publish to the Play Store later

1. Create a Google Play Console account (a one time fee) and an app with the id `app.docent.guide`.
2. Make an upload keystore once and keep it safe: losing it means you cannot update the app.
   `keytool -genkeypair -v -keystore docent-upload.jks -alias docent -keyalg RSA -keysize 2048 -validity 10000`
3. Add four repository secrets in GitHub (Settings, Secrets and variables, Actions): `ANDROID_KEYSTORE_BASE64`
   (the output of `base64 -i docent-upload.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
   `ANDROID_KEY_PASSWORD`. The workflow then also builds a signed `docent-android-release.aab`, which is the file the
   Play Console asks for.
4. The Play Console asks why the app uses location in the background. The answer: turn by turn directions keep
   working with the screen off, only while directions are running.

### iOS

The iOS project is in `mobile/ios`. Building it needs a Mac with Xcode, and installing on phones or publishing needs
an Apple Developer account. Open it with `npx cap open ios` from `mobile/`. It is not built in CI yet.
