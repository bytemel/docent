"use client";

import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";
import { getVoice } from "@/lib/voice";

const subscribe = (cb: () => void) => getVoice().subscribe(cb);
const snapshot = () => (getVoice().supported ? (getVoice().enabled() ? "on" : "off") : "none");
const serverSnapshot = () => "none";

export function useVoiceEnabled(): { supported: boolean; on: boolean } {
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return { supported: state !== "none", on: state === "on" };
}

export default function VoiceToggle({ className = "", showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { supported, on } = useVoiceEnabled();
  if (!supported) return null;
  const label = on ? "Voice on. Tap to mute" : "Voice off. Tap to hear directions";
  const toggle = () => {
    const voice = getVoice();
    const next = !voice.enabled();
    if (next) voice.unlock();
    voice.setEnabled(next);
    if (next) voice.speak("Voice directions on.", { interrupt: true });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`btn ${showLabel ? "" : "btn-icon"} ${on ? "btn-primary" : ""} ${className}`}
    >
      {on ? <SpeakerHigh size={20} weight="bold" aria-hidden /> : <SpeakerSlash size={20} weight="bold" aria-hidden />}
      {showLabel ? <span>{on ? "Voice on" : "Voice off"}</span> : null}
    </button>
  );
}
