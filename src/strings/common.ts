export const brand = {
  name: "Docent",
  attribution: "Map data © OpenStreetMap contributors, tiles by OpenFreeMap",
};

export const landing = {
  headline: "Directions that talk you to the gate.",
  subtext: "Walk, run or ride. Docent shows the way and says each turn out loud.",
  go: { title: "Get directions", body: "From where you are, with voice", href: "/go" },
  share: { title: "Share a route", body: "Make a link that plays the way", href: "/new" },
  ask: { title: "Ask where they are", body: "Send a link that asks for their location", href: "/new?ask=1" },
  example: "Watch an example",
  exampleFrameLabel: "The example route playing: Westlands to Kangemi",
  pin: {
    title: "A pin gets you to the estate. Not to the gate.",
    body: "The last few hundred metres are where people get lost. So the way travels by voice note, by phone call and by asking around.",
    quotes: [
      { text: "Ukifika stage, uliza tu.", gloss: "When you reach the stage, just ask." },
      { text: "Pass Naivas, then the blue gate.", gloss: null },
      { text: "Nitakupigia ukifika.", gloss: "I will call you when you arrive." },
    ],
  },
  voice: {
    title: "It talks you through the last 500 metres",
    body: "Every step is a plate you can read at a glance, with the landmark you will actually see. Keep the phone in your pocket and listen.",
    hear: "Hear an example",
    stop: "Stop",
    noVoice: "This browser cannot speak. The steps still show on screen.",
    then: "Then",
    caption: (from: string, to: string) => `From ${from} to ${to}`,
    spoken: (distance: string, text: string) => `In ${distance}, ${text}`,
  },
  move: {
    title: "Made for walking and running",
    body: "Docent follows your location, moves to the next step as you pass each turn and says it out loud. The distance to the turn and the time left update as you go.",
    stretch: (distance: string) => `The last ${distance} of the example`,
    rows: [
      { label: "Walking", kmh: 4.8 },
      { label: "Easy run", kmh: 10 },
    ],
    pace: "per km",
    about: "about",
  },
  shareStory: {
    title: "Share the way before they leave home",
    body: "Draw the route the way you really go, add the landmarks locals use and send one link. It plays in the browser, with no app and no account.",
    points: [
      "Walk, boda, matatu, car or bicycle, split where people change.",
      "Landmarks from the map, plus your own: the blue kiosk, the green gate.",
      "Saved on their phone, so it replays without data.",
    ],
  },
  travellers: {
    title: "Every leg gets its own traveller",
    body: "Walk to the stage, ride the matatu, finish on foot. Each leg plays at its own pace, in its own colour.",
    pace: (kmh: number) => `${kmh} km/h`,
    modes: {
      walk: "The last few metres to the gate.",
      boda: "From the stage to the door.",
      matatu: "Where to board and where to get off.",
      car: "Turn by turn, with landmarks.",
      bike: "Paths that cars cannot use.",
    },
  },
  phones: {
    title: "Built for cheap phones and slow data",
    facts: [
      { title: "No app to install", body: "Links open in the phone's browser." },
      { title: "No account", body: "Nobody signs up to open or follow a route." },
      { title: "Works offline", body: "A route you have opened replays without data." },
      { title: "Light on old phones", body: "Older phones get a flat map, or a dot and the step list." },
    ],
    charsUnit: "characters",
    charsBody: "The whole example route, with every landmark and step, inside one link.",
  },
  closing: { title: "Where to?" },
};

export const saved = {
  title: "Your saved routes",
  body: "Routes you have opened on this device. They stay here until you remove them.",
  untitled: "Untitled route",
  open: "Open",
  meta: (distance: string, date: string) => `${distance}, opened ${date}`,
  remove: (title: string) => `Remove ${title} from this device`,
};

export const viewer = {
  brokenTitle: "This link does not work",
  broken: "This route link is broken or incomplete. Ask the sender to share it again.",
  makeOwn: "Make a route",
  home: "Go to the home page",
  brokenHint: "Links can break when a chat app cuts them short. Ask for the full link, or open it from the original message.",
  summary: (distance: string, modes: string) => `${distance} route (${modes}). Watch it play step by step.`,
  offline: "Saved on this phone. It plays without data too.",
};

export const notFound = {
  title: "Page not found",
  body: "This road does not go anywhere. The address may be mistyped or out of date.",
  home: "Go to the home page",
  make: "Make a route",
  signTitle: "Where you can go instead",
};

export const og = {
  fallbackTitle: "Directions on Docent",
  fallbackBody: "Open the link to watch the route.",
};

export const steps = {
  place: {
    start: "the start",
    end: "your destination",
    stop: "the stop",
  },
  start: (label: string) => `Start at ${label}.`,
  startHere: "Start here.",
  headToward: (verb: string, target: string) => `${verb} toward ${target}.`,
  headCompass: (verb: string, compass: string) => `${verb} ${compass}.`,
  after: (distance: string, rest: string) => `After ${distance}, ${rest}`,
  turn: {
    slightLeft: "Turn slightly left",
    slightRight: "Turn slightly right",
    left: "Turn left",
    right: "Turn right",
    uturn: "Make a U-turn",
  },
  atLandmark: (action: string, landmark: string) => `${action} at ${landmark}.`,
  plain: (action: string) => `${action}.`,
  pass: (landmark: string, side: "left" | "right" | null) =>
    side ? `Pass ${landmark} on your ${side}.` : `Pass ${landmark}.`,
  willPass: (landmark: string) => `You will pass ${landmark}.`,
  ride: (verb: string, from: string | null, distance: string, duration: string, to: string | null) =>
    `${from ? `${verb} at ${from}.` : `${verb}.`} Ride about ${distance}, about ${duration}${to ? `, and get off at ${to}` : ""}.`,
  getOff: (next: string, at: string | null) => (at ? `Get off at ${at} and ${next}.` : `Get off and ${next}.`),
  switchTo: (next: string, at: string | null) => (at ? `At ${at}, ${next}.` : `Now ${next}.`),
  next: {
    walk: "walk",
    car: "drive",
    bike: "cycle",
    boda: "take a boda",
    matatu: "take a matatu",
  },
  arrive: (label: string) => `Arrive at ${label}.`,
  arriveNear: (label: string, landmark: string) => `Arrive at ${label}, near ${landmark}.`,
  compass: ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"],
};
