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
} as const;

export function stepLabel(i: number, n: number): string {
  return `Step ${i + 1} of ${n}`;
}

export function timeLabel(t: number): string {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
