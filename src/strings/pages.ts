export const site = {
  nav: [
    { href: "/how-it-works", label: "How it works" },
    { href: "/routes", label: "My routes" },
    { href: "/app", label: "Get the app" },
  ],
  privacy: { href: "/privacy", label: "Privacy" },
  go: { href: "/go", label: "Get directions" },
  share: { href: "/new", label: "Share a route" },
  openMenu: "Open menu",
  closeMenu: "Close menu",
  mainNav: "Main",
  footerNav: "Site",
  toolsNav: "Tools",
  footerTagline: "Directions that talk you to the gate. Made in Nairobi for walking, running and riding.",
};

export const routesPage = {
  title: "My routes",
  metaDescription: "Routes you have opened and the route you are making, saved on this phone.",
  lead: "Everything Docent keeps on this phone. None of it is stored on our servers.",
  draftTitle: "Route in progress",
  draftBody: "You started making this route. Pick up where you left off.",
  draftUntitled: "Untitled route",
  draftMeta: (legs: number, distance: string) => `${legs === 1 ? "1 leg" : `${legs} legs`}, ${distance}`,
  continueDraft: "Continue",
  discardDraft: "Discard",
  discardConfirm: "Discard this route?",
  keep: "Keep",
  savedTitle: "Saved routes",
  savedBody: "Routes you have opened. They replay without data.",
  opened: (date: string) => `Opened ${date}`,
  start: "Start directions",
  watch: "Watch",
  share: "Share",
  copied: "Link copied",
  copyFailed: "Could not copy. Open the route and share it from there.",
  remove: "Remove",
  removeConfirm: "Remove from this phone?",
  removeLabel: (title: string) => `Remove ${title}`,
  shareLabel: (title: string) => `Share ${title}`,
  untitled: "Untitled route",
  emptyTitle: "Nothing saved yet",
  emptyBody: "When you open a shared route or start making one, it shows up here. There are two ways to begin.",
  loading: "Reading this phone",
};

export const guide = {
  title: "How Docent works",
  metaDescription: "Get spoken directions from where you are, or share a route that plays the way. A plain guide to Docent.",
  lead: "Docent does two jobs. It talks you to a place from where you are standing, and it lets you send someone the way to you as one link.",
  chapters: [
    { id: "directions", label: "Get directions", body: "From where you are, with voice" },
    { id: "share", label: "Share a route", body: "Make a link that plays the way" },
    { id: "offline", label: "Offline and privacy", body: "What stays on your phone" },
  ],
  directions: {
    title: "Get directions",
    lead: "Open Get directions, allow your location, and pick a place. Docent works out the way from where you are and talks you through it.",
    moving: {
      title: "Say how you are moving",
      body: "Walk, run, cycle or drive. Docent uses your choice for the route, the time left and how early it warns you before a turn.",
      speed: (kmh: number) => `about ${kmh} km/h`,
      warn: (far: number, near: number) => `Warns at ${far} m and ${near} m`,
    },
    options: {
      title: "Pick a route",
      body: "When there is more than one good way, each route gets a tag on the map. Tap a tag to choose that route.",
      shortestBody: "The shortest way from where you are.",
      longerBody: "How much further this route is than the shortest one.",
      exampleLonger: "+120 m",
      tagTime: "about 8 min",
      tagTimeLonger: "about 9 min",
    },
    voice: {
      title: "Listen, do not stare",
      body: "Docent says each turn before you reach it, with the landmark you will see. Tap the speaker to mute it. The voice runs on your phone, so it works without data.",
      caption: "A real plate from the example route in Kangemi",
    },
    reroute: {
      title: "Took another way? No problem",
      body: (walk: number, drive: number) =>
        `If you move more than about ${walk} m off the route on foot, or ${drive} m in a car, Docent says "Rerouting" and finds a new way from where you are.`,
    },
    awake: {
      title: "The screen stays on",
      body: "While you navigate, Docent asks the phone to keep the screen on, so the next turn is always there when you look.",
    },
    cta: "Get directions",
  },
  share: {
    title: "Share a route",
    lead: "Make directions to your place once, then send them to anyone as a link. It takes four short stages.",
    stagesTitle: "Four stages",
    askTitle: "Not sure where they are? Ask",
    askBody: "Send a link that asks for their location. When they share it, you can start the route from where they are standing.",
    guestTitle: "What your guest sees",
    guestBody: "The link opens in their browser. The route plays with a traveller on each leg, then they can follow it live with voice.",
    guestPoints: [
      "The whole trip plays in under a minute, step by step.",
      "Each leg has its own traveller: walker, boda, matatu, car or bicycle.",
      "They tap Start directions to follow it from where they are.",
    ],
    cta: "Share a route",
  },
  offline: {
    title: "Offline and privacy",
    points: [
      { title: "It keeps working without data", body: "A route you have opened is saved on your phone, so it replays in a basement or a matatu. On Wi-Fi, or with Data Saver off, the map around it is saved too." },
      { title: "The route lives in the link", body: "There is no account and no route database. The link itself carries the route." },
      { title: "Your location stays with you", body: "Docent uses your location only while you use directions or choose to share it. We do not store it." },
    ],
    more: "Read the privacy policy",
  },
};

export const appPage = {
  title: "Get the app",
  metaDescription: "Docent for Android, coming to iPhone, and how to add Docent to your home screen today.",
  lead: "Docent works in any phone browser. The app does the same things, with a few things only an app can do.",
  whyTitle: "Why the app",
  why: [
    { title: "Keeps going with the screen off", body: "Directions and live sharing carry on when the phone is in your pocket or the screen locks." },
    { title: "A louder, steadier voice", body: "The voice keeps talking when other apps play sound, and it does not stop when the browser sleeps." },
    { title: "Shared links open in Docent", body: "Tap a route someone sent you on WhatsApp and choose Open with Docent, and it opens in the app, ready to play." },
  ],
  android: {
    title: "Android",
    download: "Download for Android (testers)",
    pending: "Coming to Google Play. Testers get the APK from Tim.",
    note: "Your phone may ask you to allow installs from this source. That is expected for tester builds.",
  },
  iphone: { title: "iPhone", body: "Coming soon. Until then, add Docent to your home screen from Safari." },
  inApp: { title: "You are in the app", body: "You already have Docent on this phone. There is nothing to download." },
  inAppGo: "Get directions",
  browserTitle: "Use it now in your browser",
  browserLead: "Add Docent to your home screen. It opens full screen like an app, with no download from a store.",
  androidSteps: {
    title: "Android with Chrome",
    steps: ["Open Docent in Chrome.", "Tap the three dots at the top right.", "Tap Add to Home screen, or Install app.", "Tap Install. Docent now sits with your other apps."],
  },
  iphoneSteps: {
    title: "iPhone with Safari",
    steps: ["Open Docent in Safari.", "Tap the Share button at the bottom.", "Scroll down and tap Add to Home Screen.", "Tap Add. Docent now sits with your other apps."],
  },
};

export const privacyPage = {
  title: "Privacy policy",
  metaDescription: "What Docent does with your location and your routes, which services see what, and your rights under the Kenya Data Protection Act 2019.",
  updated: (date: string) => `Last updated ${date}`,
  summaryTitle: "The short version",
  summary: [
    "Docent has no accounts and no route database.",
    "Your location is used only while you use directions or choose to share it. We do not store it.",
    "A shared route lives inside its link. Saved routes and drafts stay on your phone.",
    "Map, search and routing services see the places involved, not who you are.",
  ],
  sections: [
    {
      id: "who",
      title: "Who runs Docent",
      paras: [
        "Docent is a small service made in Nairobi, Kenya. In this policy, \"Docent\", \"we\" and \"us\" mean the people who run it. You can reach us at the email address at the end of this page.",
      ],
    },
    {
      id: "location",
      title: "Your location",
      paras: [
        "Docent asks for your location when you use Get directions, when you start directions from a shared route, when you answer an Ask where they are link, or when you share your trip live.",
        "Your phone works out where you are. Docent uses it on your phone to draw the map and to know which step is next. To find a route, the app sends your starting point and your destination to our server, which passes them to a routing service. We do not keep them.",
        "You can refuse location access. Get directions then cannot start from where you are, but shared routes still play.",
      ],
    },
    {
      id: "routes",
      title: "Routes and links",
      paras: [
        "When you share a route, the whole route (the line, the stops, the landmarks, the steps and any notes) is packed into the link itself. We do not store routes on a server. Anyone who has the link can open the route, so share it only with people you want to have it.",
        "A route to your home is personal. Think about the notes you add, such as gate descriptions, before you send the link.",
      ],
    },
    {
      id: "phone",
      title: "What stays on your phone",
      paras: [
        "Routes you open are saved in your browser or in the app, so you can open them again and replay them without data. The route you are making is saved there too, so you do not lose it if you close the page. Your voice setting is saved the same way.",
        "Docent does not send this data to its own servers. You can remove saved routes on the My routes page, or clear it all by clearing the site data in your browser or uninstalling the app. The app turns off Android cloud backup, so this data is not copied to your Google account.",
      ],
    },
    {
      id: "live",
      title: "Sharing your trip live",
      paras: [
        "If you choose Share my trip live, your position is sent every few seconds through Supabase Realtime to the people who open your live link. Positions pass through and are not saved. Sharing stops when you tap Stop sharing, finish the trip or close Docent.",
      ],
    },
    {
      id: "voice",
      title: "Voice",
      paras: ["Spoken directions are made by your phone's own text to speech. Docent does not use the microphone and does not send any audio anywhere."],
    },
  ],
  thirdTitle: "Services we use and what they see",
  thirdLead: "Docent is built on a few outside services. Each one sees only what it needs to do its job.",
  third: [
    { name: "OpenFreeMap", what: "Map tiles. Your phone downloads the map for the area you are looking at, so OpenFreeMap sees your internet address and that area." },
    { name: "Photon (Komoot) and Nominatim (OpenStreetMap)", what: "Place search and place names. When you search, the words you type go through our server to these services. When you drop a pin, or a guest sends you their location, its coordinates go the same way so the place can be named. They see the search or the coordinates, not your internet address." },
    { name: "Google", what: "Only when you paste a Google Maps link. Our server opens that link at Google to find the place it points to. Google sees the link, not your internet address." },
    { name: "Routing by FOSSGIS (routing.openstreetmap.de) or OpenRouteService", what: "Routes. They receive the start, the destination and any stops through our server, not your internet address." },
    { name: "Vercel", what: "Hosting. Vercel runs our website and server and keeps short technical logs of requests, including internet addresses and page addresses, to keep the service working and safe. A route link carries the route inside its address, so these short logs can include it." },
    { name: "Supabase", what: "Live sharing only. It passes live positions between phones while a trip is being shared and does not store them." },
  ],
  thirdNote: "We do not use advertising or tracking cookies, and we do not sell or rent data to anyone.",
  childrenTitle: "Children",
  children: "Docent is not aimed at children under 13. A parent or guardian should decide whether a child uses directions or shares their location.",
  rightsTitle: "Your rights",
  rights: [
    "Under the Kenya Data Protection Act 2019 you have the right to be told how your personal data is used, to see it, to have wrong data corrected, to have data deleted, and to object to its use.",
    "Because Docent does not keep your location or your routes on a server, most of your data is already in your hands on your phone. If you have a question or a request, email us and we will help.",
    "You can also complain to the Office of the Data Protection Commissioner in Kenya.",
  ],
  changesTitle: "Changes to this policy",
  changes: "If we change how Docent uses data, we will update this page and the date at the top. For a big change, we will also show a note in Docent.",
  contactTitle: "Contact",
  contact: "Questions about privacy, or a request about your data:",
};
