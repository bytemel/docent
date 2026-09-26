import { describe, expect, it } from "vitest";
import { pickVoice, speakable } from "@/lib/voice";

const v = (lang: string, localService = true, name = lang) => ({ lang, localService, name }) as SpeechSynthesisVoice;

describe("voice", () => {
  it("prefers Kenyan English, then British, then any English", () => {
    expect(pickVoice([v("en-US"), v("en-KE"), v("en-GB")])?.lang).toBe("en-KE");
    expect(pickVoice([v("fr-FR"), v("en-US"), v("en-GB")])?.lang).toBe("en-GB");
    expect(pickVoice([v("fr-FR"), v("en_AU")])?.lang).toBe("en_AU");
    expect(pickVoice([])).toBeNull();
  });

  it("prefers an on-device voice within a language", () => {
    expect(pickVoice([v("en-GB", false, "cloud"), v("en-GB", true, "local")])?.name).toBe("local");
  });

  it("reads units as words", () => {
    expect(speakable("In 200 m, turn left")).toBe("In 200 metres, turn left");
    expect(speakable("Ride about 4.2 km (about 15 min)")).toBe("Ride about 4.2 kilometres (about 15 minutes)");
    expect(speakable("  Pass   Naivas  ")).toBe("Pass Naivas");
  });
});

describe("voice repeat", () => {
  it("drops an identical line within 4 s unless forced", async () => {
    const spoken: string[] = [];
    class Utterance {
      text: string;
      voice: unknown = null;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      constructor(text: string) {
        this.text = text;
      }
    }
    const g = globalThis as unknown as Record<string, unknown>;
    g.SpeechSynthesisUtterance = Utterance;
    g.localStorage = { getItem: () => null, setItem: () => {} };
    g.window = { speechSynthesis: { getVoices: () => [], speak: (u: Utterance) => spoken.push(u.text), cancel: () => {}, resume: () => {}, paused: false } };
    const { getVoice } = await import("@/lib/voice");
    const voice = getVoice();
    voice.speak("Turn left now");
    voice.speak("Turn left now");
    voice.speak("Turn left now", { force: true });
    expect(spoken).toEqual(["Turn left now", "Turn left now"]);
    delete g.window;
    delete g.SpeechSynthesisUtterance;
    delete g.localStorage;
  });
});
