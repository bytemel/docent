import { lowerTier, shouldDowngrade, type Tier } from "@/lib/tier";
import { createSample, sampleTimelineInto, transferAt, type Timeline } from "@/lib/timeline";
import type { RouteDoc } from "@/lib/types";
import { formatDistance } from "@/lib/geo";
import { timeLabel } from "@/strings/player";
import type { LocationHooks } from "./location";
import type { PinEl, PlayerScene } from "./scene";

const FAIL_AFTER_MS = 20000;
const FPS_WARMUP_MS = 500;

export interface EngineCallbacks {
  playing(on: boolean): void;
  ended(on: boolean): void;
  step(i: number): void;
  follow(on: boolean): void;
  tier(t: Tier, downgraded: boolean): void;
  mapState(s: "loading" | "ready" | "failed"): void;
  noMap(): void;
  speak(i: number): void;
  hush(): void;
}

export interface EngineInit {
  container: HTMLElement;
  doc: RouteDoc;
  tl: Timeline;
  times: number[];
  pins: PinEl[];
  endpoints: { a: HTMLElement; b: HTMLElement };
  dark: boolean;
  reducedMotion: boolean;
  embed: boolean;
  autoplay: boolean;
  tier: () => Tier;
  auto: () => boolean;
  scrub: () => HTMLInputElement | null;
  time: () => HTMLElement | null;
  dragging: () => boolean;
  dist: () => HTMLElement | null;
  stepsM: number[];
  startOverview: boolean;
  cb: EngineCallbacks;
}

export class PlaybackEngine {
  private o: EngineInit;
  private scene: PlayerScene | null = null;
  private sample = createSample();
  private t = 0;
  private playing = false;
  private wantPlay: boolean;
  private userPaused = false;
  private speed = 1;
  private raf = 0;
  private last = 0;
  private step = -1;
  private ready = false;
  private measured = false;
  private fps: { begin: number; start: number; win: number; frames: number; samples: number[] } | null = null;
  private loopTimer: ReturnType<typeof setTimeout> | undefined;
  private failTimer: ReturnType<typeof setInterval>;
  private visibleWaitMs = 0;
  private failed = false;
  private cancelled = false;

  constructor(o: EngineInit) {
    this.o = o;
    this.wantPlay = o.autoplay && !o.embed;
    this.failTimer = setInterval(() => {
      if (this.ready || this.cancelled || this.failed) return;
      if (document.visibilityState !== "visible") return;
      this.visibleWaitMs += 1000;
      if (this.visibleWaitMs >= FAIL_AFTER_MS) {
        this.failed = true;
        o.cb.mapState("failed");
      }
    }, 1000);
    import("./scene")
      .then(({ PlayerScene }) => {
        if (this.cancelled) return;
        let scene: PlayerScene;
        try {
          scene = new PlayerScene({
            container: o.container,
            doc: o.doc,
            tl: o.tl,
            dark: o.dark,
            interactive: !o.embed,
            reducedMotion: o.reducedMotion,
            pins: o.pins,
            endpoints: o.endpoints,
            onFollowChange: (on) => o.cb.follow(on),
            onTierFailed: (t) => {
              if (t === o.tier()) o.cb.tier(lowerTier(t), false);
            },
            onRestore: () => {
              if (this.ready) void this.doApply(o.tier());
            },
          });
        } catch {
          o.cb.noMap();
          return;
        }
        this.scene = scene;
        return scene.ready.then(async () => {
          if (this.cancelled) return;
          await this.doApply(o.tier());
          if (this.cancelled) return;
          if (o.startOverview && !this.wantPlay) scene.showWhole(false);
          this.ready = true;
          this.failed = false;
          clearInterval(this.failTimer);
          o.cb.mapState("ready");
          if (this.wantPlay) this.play();
        });
      })
      .catch(() => {
        if (!this.cancelled) o.cb.mapState("failed");
      });
  }

  private shownT = -1;
  private quiet = false;
  private shownSec = -1;

  private ui() {
    if (Math.abs(this.t - this.shownT) >= 0.05) {
      this.shownT = this.t;
      const sc = this.o.scrub();
      if (sc && !this.o.dragging()) sc.value = this.t.toFixed(2);
      if (sc) sc.style.setProperty("--dp-fill", `${this.o.tl.totalS > 0 ? ((this.t / this.o.tl.totalS) * 100).toFixed(2) : 0}%`);
    }
    const sec = Math.round(this.t);
    if (sec !== this.shownSec) {
      this.shownSec = sec;
      const tlab = this.o.time();
      if (tlab) tlab.textContent = `${timeLabel(this.t)} / ${timeLabel(this.o.tl.totalS)}`;
    }
    const times = this.o.times;
    let idx = 0;
    for (let i = 0; i < times.length; i++) if (times[i] <= this.t + 0.05) idx = i;
    if (idx !== this.step) {
      const first = this.step < 0;
      this.step = idx;
      this.o.cb.step(idx);
      if (!first && !this.quiet && this.playing && this.speed === 1) this.o.cb.speak(idx);
    }
    this.quiet = false;
    this.showDist(idx);
  }

  private shownDist = "";

  private showDist(idx: number) {
    const el = this.o.dist();
    if (!el) return;
    const m = this.o.stepsM;
    const at = this.sample.atM;
    let next = Infinity;
    for (let j = idx + 1; j < m.length; j++) {
      if (m[j] > at + 0.5 && Number.isFinite(m[j])) {
        next = m[j];
        break;
      }
    }
    const text = Number.isFinite(next) && idx < m.length - 1 ? formatDistance(Math.max(0, next - at)) : "";
    if (text !== this.shownDist || el.textContent !== text) {
      this.shownDist = text;
      el.textContent = text;
    }
  }

  private render(dt: number) {
    sampleTimelineInto(this.o.tl, this.t, this.sample);
    this.scene?.frame(this.sample, dt, this.playing);
    this.ui();
  }

  private startMeasure() {
    if (!this.o.auto() || this.measured || this.o.tier() === "basic") return;
    this.fps = { begin: 0, start: 0, win: 0, frames: 0, samples: [] };
  }

  private measure(ts: number) {
    const f = this.fps;
    if (!f) return;
    if (!f.begin) {
      f.begin = ts;
      return;
    }
    if (ts - f.begin < FPS_WARMUP_MS) return;
    if (!f.start) {
      f.start = ts;
      f.win = ts;
      return;
    }
    f.frames++;
    if (ts - f.win >= 250) {
      f.samples.push((f.frames * 1000) / (ts - f.win));
      f.win = ts;
      f.frames = 0;
    }
    if (ts - f.start >= 2000) {
      this.fps = null;
      this.measured = true;
      const tier = this.o.tier();
      if (this.o.auto() && tier !== "basic" && shouldDowngrade(f.samples)) {
        this.measured = false;
        this.o.cb.tier(lowerTier(tier), true);
      }
    }
  }

  private schedule() {
    if (this.raf || this.cancelled) return;
    if (this.playing || this.scene?.needsFrames()) this.raf = requestAnimationFrame(this.loop);
    else this.last = 0;
  }

  private loop = (ts: number) => {
    this.raf = 0;
    const raw = this.last ? (ts - this.last) / 1000 : 1 / 60;
    const dt = Math.min(0.5, raw);
    this.last = ts;
    if (this.playing) {
      this.t += Math.min(0.25, raw) * this.speed;
      if (this.speed >= 4) {
        const tr = transferAt(this.o.tl, this.t);
        if (tr) this.t = tr.t1;
      }
      this.measure(ts);
      if (this.t >= this.o.tl.totalS) {
        this.t = this.o.tl.totalS;
        this.render(dt);
        this.finish();
        this.schedule();
        return;
      }
    }
    this.render(dt);
    this.schedule();
  };

  private kick() {
    if (!this.raf && !this.cancelled) this.raf = requestAnimationFrame(this.loop);
  }

  private snap() {
    sampleTimelineInto(this.o.tl, this.t, this.sample);
    this.scene?.snapCamera(this.sample);
  }

  private finish() {
    this.playing = false;
    this.fps = null;
    this.o.cb.playing(false);
    if (this.o.embed) {
      this.loopTimer = setTimeout(() => {
        this.t = 0;
        this.snap();
        this.play();
      }, 1500);
    } else {
      this.o.cb.ended(true);
    }
  }

  private async doApply(t: Tier): Promise<void> {
    if (!this.scene) return;
    const actual = await this.scene.setTier(t);
    if (this.cancelled || actual === null) return;
    const wanted = this.o.tier();
    if (wanted !== t) return this.doApply(wanted);
    if (actual !== t) this.o.cb.tier(actual, false);
    this.snap();
    this.render(0);
    this.kick();
    if (this.playing) this.startMeasure();
  }

  play() {
    this.userPaused = false;
    clearTimeout(this.loopTimer);
    if (!this.ready) {
      this.wantPlay = true;
      this.o.cb.playing(true);
      return;
    }
    if (this.t >= this.o.tl.totalS - 0.01) {
      this.t = 0;
      this.snap();
    }
    this.o.cb.ended(false);
    this.playing = true;
    this.o.cb.playing(true);
    if (this.t < 0.05 && this.speed === 1) this.o.cb.speak(Math.max(0, this.step));
    this.startMeasure();
    this.kick();
  }

  pause(user = true) {
    if (user) this.userPaused = true;
    clearTimeout(this.loopTimer);
    this.wantPlay = false;
    this.playing = false;
    this.fps = null;
    this.o.cb.playing(false);
    this.o.cb.hush();
    this.kick();
  }

  toggle() {
    if (this.playing || (!this.ready && this.wantPlay)) this.pause();
    else this.play();
  }

  visible(on: boolean) {
    if (on && this.o.autoplay && !this.userPaused) this.play();
    else if (!on && (this.playing || this.wantPlay)) this.pause(false);
  }

  seek(t: number) {
    const total = this.o.tl.totalS;
    this.t = Math.max(0, Math.min(total, t));
    if (this.t < total) this.o.cb.ended(false);
    this.quiet = true;
    this.o.cb.hush();
    this.snap();
    this.kick();
  }

  nudge(d: number) {
    this.seek(this.t + d);
  }

  setSpeed(v: number) {
    this.speed = v;
    if (v !== 1) this.o.cb.hush();
  }

  refreshDist() {
    this.shownDist = "";
    this.showDist(Math.max(0, this.step));
  }

  applyTier(t: Tier) {
    if (this.ready) void this.doApply(t);
  }

  showWhole() {
    this.scene?.showWhole(true);
  }

  follow() {
    this.scene?.setFollow(true);
    if (this.o.reducedMotion) this.snap();
    this.kick();
  }

  startLocation(hooks: LocationHooks) {
    this.scene?.startLocation(hooks);
  }

  stopLocation() {
    this.scene?.stopLocation();
  }

  followMe(on: boolean) {
    this.scene?.followMe(on);
  }

  guideMe() {
    this.scene?.guideMe();
  }

  destroy() {
    this.cancelled = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    clearTimeout(this.loopTimer);
    clearInterval(this.failTimer);
    this.scene?.destroy();
    this.scene = null;
  }
}
