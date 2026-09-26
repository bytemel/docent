export const brand = {
  name: "Docent",
  attribution: "Map data © OpenStreetMap contributors, tiles by OpenFreeMap",
};

export const landing = {
  headline: "Show people the way, not just the pin.",
  subtext: "One link that plays the trip, with the stage, the petrol station and the gate your guest will see.",
  make: "Make a route",
  example: "Watch an example",
  exampleFrameLabel: "The example route playing: Westlands to Kangemi",
  exampleCaption: (distance: string, modes: string) => `${distance}, ${modes}`,
  problem: {
    title: "A pin gets them to the estate. Not to the gate.",
    body: "So the rest of the way travels by voice note, by phone call and by asking around.",
    sent: [
      { text: "Ukifika stage, uliza tu.", gloss: "When you reach the stage, just ask." },
      { text: "Pass Naivas, then the blue gate.", gloss: null },
      { text: "Nitakupigia ukifika.", gloss: "I will call you when you arrive." },
      { text: "You can't miss it.", gloss: null },
    ],
    insteadTitle: "Docent sends the way itself",
    insteadBody: "The same trip as steps your guest can follow, written from the route and the map around it.",
    linkNote: (chars: string) => `The whole trip above is packed into ${chars} characters of one link.`,
  },
  how: {
    title: "Three moments, one link",
    ask: {
      title: "Ask where they are",
      body: "Send your guest a link that asks for their location. When they share it, the route can start from where they are standing.",
    },
    shape: {
      title: "Shape the way you actually go",
      body: "Drag the line onto the shortcut. Draw the footpath the map does not know. Change from matatu to walking at the stage where people really get off.",
    },
    send: {
      title: "Send one link that plays",
      body: "Paste it into WhatsApp or an SMS. It opens in the browser and plays the trip. No app and no account.",
    },
  },
  travellers: {
    title: "Every leg gets its own traveller",
    body: "Walk to the stage, ride the matatu, finish on foot. The trip plays at the pace of each mode, with the line in its own colour.",
    pace: (kmh: number) => `about ${kmh} km/h`,
    modes: {
      walk: "The last few metres to the gate.",
      boda: "From the stage to the door.",
      matatu: "Where to board and where to get off.",
      car: "Turn by turn, with landmarks.",
      bike: "Paths that cars cannot use.",
    },
  },
  phones: {
    title: "Made for real phones and slow data",
    body: "Your guest may be on a small Android with little data left. Docent keeps the trip light.",
    facts: [
      { title: "No app to install", body: "The link opens in the phone's browser." },
      { title: "No account to watch", body: "Nobody signs up or logs in to open a route." },
      { title: "A pin or a plus code works", body: "Paste a Google Maps pin or a plus code to set a place." },
      { title: "Slow phones get a lighter view", body: "Older phones get a flat map, or a simple dot and the step list." },
    ],
    linkTitle: (chars: string) => `${chars} characters`,
    linkBody: "The size of the example route inside its link, with every landmark and step included.",
  },
  closing: {
    title: "Next time someone asks for directions, send the way.",
    body: "It takes a few minutes to make, and your guest can watch it before they leave home.",
  },
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
    `${from ? `${verb} at ${from}.` : `${verb}.`} Ride about ${distance} (about ${duration})${to ? ` and get off at ${to}` : ""}.`,
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
