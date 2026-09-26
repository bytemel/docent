"use client";

import { SpeakerHigh, Stop } from "@phosphor-icons/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getVoice } from "@/lib/voice";
import { landing } from "@/strings/common";

const noop = () => () => {};

export default function HearExample({ lines }: { lines: string[] }) {
  const supported = useSyncExternalStore(noop, () => getVoice().supported, () => true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (!window.speechSynthesis?.speaking) setPlaying(false);
    }, 400);
    return () => window.clearInterval(id);
  }, [playing]);

  if (!supported) return <p className="text-sm opacity-80">{landing.voice.noVoice}</p>;

  const toggle = () => {
    const voice = getVoice();
    if (playing) {
      voice.cancel();
      setPlaying(false);
      return;
    }
    voice.unlock();
    if (!voice.enabled()) voice.setEnabled(true);
    lines.forEach((line, i) => voice.speak(line, { interrupt: i === 0 }));
    setPlaying(true);
  };

  return (
    <button type="button" onClick={toggle} className="btn btn-primary btn-lg" aria-pressed={playing}>
      {playing ? <Stop size={22} weight="fill" aria-hidden /> : <SpeakerHigh size={22} weight="bold" aria-hidden />}
      {playing ? landing.voice.stop : landing.voice.hear}
    </button>
  );
}
