export interface SpeakOptions {
  interrupt?: boolean;
  force?: boolean;
}

export interface Voice {
  readonly supported: boolean;
  enabled(): boolean;
  setEnabled(on: boolean): void;
  unlock(): void;
  speak(text: string, opts?: SpeakOptions): void;
  cancel(): void;
  subscribe(listener: (enabled: boolean) => void): () => void;
}

import { hasPlugin, isNativeApp, nativeSpeak, nativeStopSpeaking } from "./native";

const STORAGE_KEY = "docent:voice";
const LANG_ORDER = ["en-KE", "en-GB", "en-US", "en-ZA", "en-IN", "en"];

export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const lang of LANG_ORDER) {
    const exact = voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(lang.toLowerCase()));
    if (exact.length) return exact.find((v) => v.localService) ?? exact[0];
  }
  return voices[0] ?? null;
}

export function speakable(text: string): string {
  return text
    .replace(/\bkm\b/g, "kilometres")
    .replace(/(\d)\s?m\b/g, "$1 metres")
    .replace(/\bmin\b/g, "minutes")
    .replace(/\s+/g, " ")
    .trim();
}

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function createVoice(): Voice {
  const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
  const native = isNativeApp() && hasPlugin("TextToSpeech");
  const can = native || Boolean(synth);
  const listeners = new Set<(enabled: boolean) => void>();
  let on = can ? readEnabled() : false;
  let chosen: SpeechSynthesisVoice | null = null;
  let last = "";
  let lastAt = 0;

  const refresh = () => {
    if (synth) chosen = pickVoice(synth.getVoices());
  };
  if (synth) {
    refresh();
    synth.addEventListener?.("voiceschanged", refresh);
  }

  const utter = (text: string, volume = 1) => {
    const u = new SpeechSynthesisUtterance(text);
    if (chosen) {
      u.voice = chosen;
      u.lang = chosen.lang;
    } else {
      u.lang = "en-GB";
    }
    u.rate = 1;
    u.pitch = 1;
    u.volume = volume;
    return u;
  };

  return {
    supported: can,
    enabled: () => on,
    setEnabled(next) {
      on = can && next;
      try {
        localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
      } catch {}
      if (!on) {
        synth?.cancel();
        if (native) void nativeStopSpeaking();
      }
      listeners.forEach((l) => l(on));
    },
    unlock() {
      if (native || !synth) return;
      refresh();
      synth.speak(utter(" ", 0));
    },
    speak(text, opts = {}) {
      if (!can || !on) return;
      const clean = speakable(text);
      if (!clean) return;
      const now = Date.now();
      if (!opts.force && clean === last && now - lastAt < 4000) return;
      last = clean;
      lastAt = now;
      if (native) {
        void nativeSpeak(clean, { interrupt: opts.interrupt }).then((ok) => {
          if (ok || !synth) return;
          if (opts.interrupt) synth.cancel();
          synth.speak(utter(clean));
        });
        return;
      }
      if (!synth) return;
      if (opts.interrupt) synth.cancel();
      if (synth.paused) synth.resume();
      synth.speak(utter(clean));
    },
    cancel() {
      synth?.cancel();
      if (native) void nativeStopSpeaking();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let instance: Voice | null = null;

export function getVoice(): Voice {
  if (!instance) instance = createVoice();
  return instance;
}
