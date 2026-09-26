# Docent design system

Docent is a guide. It shows you the way, then it talks you through it. The interface borrows from wayfinding
signage: plates you can read at a glance, one strong signal colour, and big targets for a thumb on the move.

## Principles
1. **Directions first.** Every screen answers "where do I go next" before anything else.
2. **Readable while moving.** Big type, high contrast, 56 px primary actions, controls in the thumb zone.
3. **It talks.** Wherever directions show, a speaker toggle sits next to them.
4. **Local and plain.** Stage, boda, matatu, gate. Short sentences. No dashes, no emojis.

## Type
- Overpass (the highway sign lineage) for everything. Display: 800 or 900, tracking -0.02em, line height 1.02 to 1.1.
  UI: 600 or 700. Body: 400 or 500.
- Overpass Mono through the `.num` class for distances, times, pace, step numbers and anything that ticks.
- Scale on phones: 40 / 28 / 22 / 17 / 15 / 13. Desktop display up to 72.

## Colour (tokens in src/app/globals.css)
- Neutrals: `bg`, `surface`, `surface-2`, `ink`, `ink-2`, `ink-3`, `line`.
- One signal accent: `accent` (yellow) is a FILL with `accent-ink` text. Never put yellow text on a light background:
  use `text-accent-text` for accent coloured words.
- `sign` / `sign-ink`: the high contrast plate (ink on light, light on dark) for direction cards and secondary CTAs.
- Mode colours in src/lib/modes.ts are map data only (route lines, legends), never UI chrome.

## Shape and depth
- Controls 14 px (`.btn`, `.field`), chips 12 px, cards and sheets 18 px (`.panel`, `.sign`). No pill buttons.
- Borders 1.5 px on controls. One soft shadow token for floating things over the map. No glows, no gradients.

## Components
- `.btn`, `.btn-primary` (yellow), `.btn-sign` (plate), `.btn-ghost`, `.btn-lg` (56 px), `.btn-icon`.
- `.chip` with `aria-pressed` for segmented choices.
- The direction card (`.sign`): a yellow square with a bold Phosphor arrow (48 to 64 px), the distance in `.num`
  at 32 to 40 px, the instruction at 20 to 24 px bold, the next step small underneath.
- `VoiceToggle` (src/components/ui/VoiceToggle.tsx) wherever directions are shown.
- Icons: Phosphor. `bold` weight for arrows and primary actions, `regular` elsewhere.

## Motion
- Purposeful only: a route line that draws on, the direction card sliding up 12 px on change (160 ms), the
  traveller moving. Nothing decorative. Honour reduced motion everywhere.

## Layout
- Phone first. Maps are full bleed. Sheets come up from the bottom; primary actions sit in the bottom third.
- Desktop: map fills the page, a 400 px panel on the left, never centred marketing boxes around a tool.
- 320 to 1920 px with no sideways scroll. No orphans in grids. No three equal cards. One eyebrow per three sections at most.

## Voice and copy
- Imperative and short: "Turn left at Total." "In 200 m, keep right." "You have arrived. Green gate, ring the bell."
- Distances in metres under 1 km, then km with one decimal. Times as "about 12 min".
