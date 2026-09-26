import { lowerTier, shouldDowngrade, type Tier } from "@/lib/tier";
import { createSample, sampleTimelineInto, transferAt, type Timeline } from "@/lib/timeline";
import type { RouteDoc } from "@/lib/types";
import { timeLabel } from "@/strings/player";
import type { PinEl, PlayerScene } from "./scene";

export interface EngineCallbacks {
  playing(on: boolean): void;
  ended(on: boolean): void;
  step(i: number): void;
  follow(on: boolean): void;
  tier(t: Tier, downgraded: boolean): void;
  mapState(s: "loading" | "ready" | "failed"): void;
  noMap(): void;
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
  private fps: { start: number; win: number; frames: number; samples: number[] } | null = null;
  private loopTimer: ReturnType<typeof setTimeout> | undefined;
  private failTimer: ReturnType<typeof setTimeout>;
  private cancelled = false;

  constructor(o: EngineInit) {
    this.o = o;
    this.wantPlay = o.autoplay && !o.embed;
    this.failTimer = setTimeout(() => {
      if (!this.ready && !this.cancelled) o.cb.mapState("failed");
    }, 20000);
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
          this.ready = true;
          o.cb.mapState("ready");
          if (this.wantPlay) this.play();
        });
      })
      .catch(() => {
        if (!this.cancelled) o.cb.mapState("failed");
      });
  }

  private ui() {
    const sc = this.o.scrub();
    if (sc && !this.o.dragging()) sc.value = String(this.t);
    const tlab = this.o.time();
    if (tlab) tlab.textContent = `${timeLabel(this.t)} / ${timeLabel(this.o.tl.totalS)}`;
    const times = this.o.times;
    let idx = 0;
    for (let i = 0; i < times.length; i++) if (times[i] <= this.t + 0.05) idx = i;
    if (idx !== this.step) {
      this.step = idx;
      this.o.cb.step(idx);
    }
  }

  private render(dt: number) {
    sampleTimelineInto(this.o.tl, this.t, this.sample);
    this.scene?.frame(this.sample, dt, this.playing);
    this.ui();
  }

  private startMeasure() {
    if (!this.o.auto() || this.measured || this.o.tier() === "basic") return;
    this.fps = { start: 0, win: 0, frames: 0, samples: [] };
  }

  private measure(ts: number) {
    const f = this.fps;
    if (!f) return;
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
      this.t += Math.min(0.1, raw) * this.speed;
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

  private async doApply(t: Tier) {
    if (!this.scene) return;
    const actual = await this.scene.setTier(t);
    if (this.cancelled) return;
    if (actual !== this.o.tier()) this.o.cb.tier(actual, false);
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
    this.snap();
    this.kick();
  }

  nudge(d: number) {
    this.seek(this.t + d);
  }

  setSpeed(v: number) {
    this.speed = v;
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

  destroy() {
    this.cancelled = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    clearTimeout(this.loopTimer);
    clearTimeout(this.failTimer);
    this.scene?.destroy();
    this.scene = null;
  }
}
