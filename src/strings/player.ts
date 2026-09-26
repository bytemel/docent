export const PLAYER = {
  play: "Play",
  pause: "Pause",
  replay: "Replay",
  close: "Close",
  speed: "Speed",
  seek: "Move through the route",
  view: "View",
  tier3d: "3D",
  tier2d: "Flat",
  tierBasic: "Simple",
  showWhole: "Show whole route",
  follow: "Follow",
  steps: "Steps",
  showSteps: "Show all steps",
  hideSteps: "Hide steps",
  distance: "Distance",
  realTime: "Real travel time",
  modes: "Travel by",
  playbackNote: "The animation is sped up. Real times are shown here.",
  currentStep: "Current step",
  noSteps: "No steps yet.",
  loadingMap: "Loading the map",
  switchedLighter: "Switched to a lighter view for smoother playback",
  noWebgl: "This device cannot show the map, so here are the steps in writing.",
  crashed: "Something went wrong with the animation, so here are the steps in writing.",
  showMe: "Show where I am",
  stopShowingMe: "Stop sharing",
  followMe: "Follow me",
  locWaiting: "Finding where you are",
  locWeak: "Looking for a better GPS signal. Try near a window or outside.",
  locDenied: "Location is off for this page. You can allow it in your browser settings.",
  locUnavailable: "This device cannot share its location right now.",
  guideMe: "Guide me to the route",
  guideLoading: "Finding a way to the route",
  guideFailed: "Could not find a path, so the line is straight.",
  now: "Now:",
  next: "Next:",
  keepOpen: "Keep this page open while you walk.",
  theSender: "the sender",
  liveFailed: "Live sharing did not start. Please try again.",
  liveConnecting: "Connecting",
  liveOn: "Sharing live",
  liveStopped: "Not sharing",
  liveOffline: "Offline. It will try again.",
  liveUnavailable: "Live sharing is not available right now.",
  liveLinkNote: "Send this link to the host so they can watch you.",
  copyLink: "Copy link",
  copied: "Copied",
  whatsapp: "Send on WhatsApp",
  stopLive: "Stop live sharing",
  mapFailed: "The map did not load. The steps below still show the way.",
  arrived: "You have arrived",
  openGoogleMaps: "Open in Google Maps",
  makeYourOwn: "Make your own route",
  editCopy: "Edit a copy",
  start: "Start",
  destination: "Destination",
  untitled: "Route",
  from: "From",
  to: "To",
  keyboardHint: "Space plays or pauses. Arrow keys move 5 seconds.",
  preview: "Preview",
  startDirections: "Start directions",
  watchRoute: "Watch the route",
  watchHint: "A short animation of the trip, with each step read out.",
  routeFor: "Directions sent to you",
  time: "Time",
  about: "about",
  overview: "Route overview",
  repeatStep: "Tap to hear this step again",
  then: "Then",
  arrivalHeading: "You are there",
  stepsCount: "steps",
  animationSpeed: "Animation speed",
  mapView: "Map view",
  allSteps: "All steps",
  backToOverview: "Back to overview",
  followTraveller: "Follow the traveller",
  stepsHeading: "The way, step by step",
  viaModes: "By",
  googleMaps: "Google Maps",
} as const;

export const GLYPH_LABEL: Record<string, string> = {
  start: "Start",
  arrive: "Arrive",
  left: "Turn left",
  right: "Turn right",
  slightLeft: "Slight left",
  slightRight: "Slight right",
  uturn: "U-turn",
  straight: "Go straight",
  landmark: "Landmark",
  walk: "Walk",
  boda: "Boda",
  matatu: "Matatu",
  car: "Drive",
  bike: "Cycle",
};

export function fromToLabel(from: string, to: string): string {
  return `${from} to ${to}`;
}

export function aboutTime(duration: string): string {
  return `about ${duration}`;
}

export function stepLabel(i: number, n: number): string {
  return `Step ${i + 1} of ${n}`;
}

export function timeLabel(t: number): string {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function toGoLabel(distance: string): string {
  return `${distance} to go`;
}

export function offRouteLabel(distance: string): string {
  return `You are ${distance} from the route`;
}

export function shareLiveLabel(name: string): string {
  return `Share live with ${name}`;
}

export function whatsappText(url: string): string {
  return `Watch me on the way: ${url}`;
}
