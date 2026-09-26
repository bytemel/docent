export const brand = {
  name: "Docent",
  attribution: "Map data © OpenStreetMap contributors, tiles by OpenFreeMap",
};

export const landing = {
  headline: "Show people the way, not just the pin.",
  subtext: "Draw the way you really go, add the landmarks locals use, and send one link that plays the trip.",
  make: "Make a route",
  example: "Watch an example",
  exampleFrameLabel: "An example route playing",
  howTitle: "How it works",
  how: [
    {
      title: "Pick the start and the destination",
      body: "Search for a place, tap the map, or use where you are now.",
    },
    {
      title: "Shape the route the way you actually go",
      body: "Drag the line onto the shortcut, or draw the footpath the map does not know.",
    },
    {
      title: "Add the landmarks only locals know",
      body: "The petrol station, the church, the blue kiosk by the gate. Docent finds some for you.",
    },
    {
      title: "Send one link that plays the trip",
      body: "Your guest watches the route play step by step. No app and no account needed.",
    },
  ],
  modesTitle: "Walk, boda, matatu, car or bicycle",
  modesBody:
    "Most trips mix more than one. Split the route where people change, and each part plays with its own colour and speed.",
  modes: {
    walk: "On foot, including the last few metres to the gate.",
    boda: "A motorbike ride from the stage.",
    matatu: "Where to board, how far to ride and where to get off.",
    car: "Turn by turn, with the landmarks at each turn.",
    bike: "Cycling routes that can use paths cars cannot.",
  },
};

export const viewer = {
  brokenTitle: "This link does not work",
  broken: "This route link is broken or incomplete. Ask the sender to share it again.",
  makeOwn: "Make a route",
  home: "Go to the home page",
  summary: (distance: string, modes: string) => `A ${distance} route: ${modes}. Watch it play step by step.`,
};

export const notFound = {
  title: "Page not found",
  body: "We could not find that page. The link may be wrong or out of date.",
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
