"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Landmark, LngLat, Mode, RouteDoc, Segment, Walker } from "@/lib/types";
import { MODES } from "@/lib/modes";
import { uid } from "@/lib/geo";
import { buildSteps } from "@/lib/steps";
import { findLandmarks } from "@/lib/landmarks";
import { decodeDoc } from "@/lib/share";
import { routeLeg, routeOptions, type RouteOption } from "@/lib/routing";
import { overlapRatio } from "@/lib/server/alternatives";
import { clearDraft, flushDraft, loadDraft, saveDraft } from "@/lib/draft";
import { amendHistory, canRedo, canUndo, createHistory, pushHistory, redo, undo, type History } from "@/lib/history";
import { t } from "@/strings/editor";
import { reverseName } from "./api";
import {
  addVia,
  defaultTitle,
  emptyDoc,
  legPoints,
  mergeAtStop,
  mergeLandmarks,
  mergeSteps,
  MAX_VIAS,
  storedSteps,
  moveVia,
  moveWaypoint,
  nameWaypoint,
  newSegment,
  patchDocRoute,
  removeVia,
  revertDrawn,
  segKey,
  setDrawn,
  setMode,
  setWaypointLabel,
  splitSegment,
  withRoute,
  waypoints,
} from "./ops";
import type { LegStatus } from "./RouteStage";
import type { Pending, RouteHit, Stage, Tool, ViaRef } from "./types";
import { initialState, type InitState, type Phase } from "./init";

function routedKeys(doc: RouteDoc): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of doc.segments) if (!s.drawn && s.geometry.length > 2) out[s.id] = segKey(s);
  return out;
}

function initial(): InitState {
  if (typeof window === "undefined")
    return { doc: emptyDoc(), phase: "setup", draft: null, saveArmed: true, badLink: false, pending: { start: null, end: null }, ask: false };
  return initialState(window.location.search, loadDraft, decodeDoc);
}

const omit = (m: Record<string, string>, id: string) => {
  const n = { ...m };
  delete n[id];
  return n;
};

export function useEditor() {
  const [init] = useState(initial);
  const [hist, setHist] = useState<History<RouteDoc>>(() => createHistory(init.doc));
  const [phase, setPhase] = useState<Phase>(init.phase);
  const [routed, setRouted] = useState<Record<string, string>>(() => routedKeys(init.doc));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending>(init.pending);
  const [naming, setNaming] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>({ kind: "none" });
  const [stage, setStage] = useState<Stage>(init.phase === "edit" ? "route" : "where");
  const [asking, setAsking] = useState(init.ask);
  const [selectedVia, setSelectedVia] = useState<ViaRef | null>(null);
  const [draftLandmark, setDraftLandmark] = useState<LngLat | null>(null);
  const [focusStop, setFocusStop] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(init.badLink ? t.badLink : null);
  const [saveArmed, setSaveArmed] = useState(init.saveArmed);
  const [lmLoading, setLmLoading] = useState(false);
  const [fitTick, setFitTick] = useState(init.phase === "edit" || init.pending.start ? 1 : 0);
  const inflight = useRef(new Map<string, { key: string; ctrl: AbortController }>());
  const fitAfterRoute = useRef(init.phase === "edit");
  const segsRef = useRef<Segment[]>(init.doc.segments);
  const doc = hist.present;

  const commit = useCallback((fn: (d: RouteDoc) => RouteDoc, key?: string) => {
    setHist((h) => pushHistory(h, fn(h.present), { key }));
    setSaveArmed(true);
  }, []);

  const clearTransient = () => {
    setTool({ kind: "none" });
    setSelectedVia(null);
    setDraftLandmark(null);
  };

  const status = useCallback(
    (s: Segment): LegStatus => {
      if (s.drawn) return "ok";
      const key = segKey(s);
      if (routed[s.id] === key) return "ok";
      if (errors[s.id] === key) return "error";
      return "loading";
    },
    [routed, errors],
  );

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (!sp.has("d") && !sp.has("from") && !sp.has("ask")) return;
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    segsRef.current = doc.segments;
  }, [doc.segments]);

  useEffect(() => {
    if (phase !== "edit") return;
    const map = inflight.current;
    const live = new Set<string>();
    for (const seg of doc.segments) {
      live.add(seg.id);
      const cur = map.get(seg.id);
      const key = seg.drawn ? "" : segKey(seg);
      if (seg.drawn || routed[seg.id] === key || errors[seg.id] === key) {
        if (cur && cur.key !== key) {
          cur.ctrl.abort();
          map.delete(seg.id);
        }
        continue;
      }
      if (cur?.key === key) continue;
      cur?.ctrl.abort();
      const ctrl = new AbortController();
      map.set(seg.id, { key, ctrl });
      routeLeg(MODES[seg.mode].profile, legPoints(seg), ctrl.signal)
        .then((r) => {
          if (ctrl.signal.aborted) return;
          map.delete(seg.id);
          setHist((h) => ({
            ...h,
            past: h.past.map((d) => patchDocRoute(d, seg.id, key, r.geometry)),
            present: patchDocRoute(h.present, seg.id, key, r.geometry),
            future: h.future.map((d) => patchDocRoute(d, seg.id, key, r.geometry)),
          }));
          setRouted((m) => ({ ...m, [seg.id]: key }));
          if (fitAfterRoute.current) {
            fitAfterRoute.current = false;
            setFitTick((n) => n + 1);
          }
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          map.delete(seg.id);
          setErrors((m) => ({ ...m, [seg.id]: key }));
        });
    }
    for (const [id, f] of map) {
      if (!live.has(id)) {
        f.ctrl.abort();
        map.delete(id);
      }
    }
  }, [doc.segments, phase, routed, errors]);

  useEffect(() => {
    const map = inflight.current;
    return () => {
      for (const f of map.values()) f.ctrl.abort();
      map.clear();
    };
  }, []);

  const [options, setOptions] = useState<Record<string, { key: string; list: RouteOption[] }>>({});
  const optInflight = useRef(new Map<string, { key: string; ctrl: AbortController }>());

  useEffect(() => {
    if (phase !== "edit" || stage !== "route") return;
    const map = optInflight.current;
    for (const seg of doc.segments) {
      if (seg.drawn) continue;
      const key = segKey(seg);
      if (routed[seg.id] !== key || options[seg.id]?.key === key) continue;
      const cur = map.get(seg.id);
      if (cur?.key === key) continue;
      cur?.ctrl.abort();
      const ctrl = new AbortController();
      map.set(seg.id, { key, ctrl });
      routeOptions(MODES[seg.mode].profile, legPoints(seg), ctrl.signal)
        .then((list) => {
          if (ctrl.signal.aborted) return;
          map.delete(seg.id);
          setOptions((o) => ({ ...o, [seg.id]: { key, list } }));
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          map.delete(seg.id);
          setOptions((o) => ({ ...o, [seg.id]: { key, list: [] } }));
        });
    }
  }, [doc.segments, phase, stage, routed, options]);

  useEffect(() => {
    const map = optInflight.current;
    return () => {
      for (const f of map.values()) f.ctrl.abort();
      map.clear();
    };
  }, []);

  const legOptions = useMemo(() => {
    const out: Record<string, { list: RouteOption[]; selectedId: string | null }> = {};
    for (const seg of doc.segments) {
      const o = options[seg.id];
      if (seg.drawn || !o || o.key !== segKey(seg) || o.list.length < 2) continue;
      let best: string | null = null;
      let score = 0.8;
      for (const opt of o.list) {
        const r = overlapRatio(seg.geometry, opt.geometry, 40, 15);
        if (r > score) {
          score = r;
          best = opt.id;
        }
      }
      out[seg.id] = { list: o.list, selectedId: best };
    }
    return out;
  }, [doc.segments, options]);

  const allRouted = phase === "edit" && doc.segments.every((s) => status(s) !== "loading");
  const geoSig = allRouted ? doc.segments.map((s) => `${s.id}:${s.geometry.length}:${s.distanceM}`).join("|") : "";

  useEffect(() => {
    if (!geoSig) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setLmLoading(true);
      findLandmarks(segsRef.current, { signal: ctrl.signal })
        .then((fresh) => {
          if (ctrl.signal.aborted) return;
          setHist((h) => {
            const landmarks = mergeLandmarks(h.present.landmarks, fresh);
            return JSON.stringify(landmarks) === JSON.stringify(h.present.landmarks)
              ? h
              : amendHistory(h, { ...h.present, landmarks });
          });
        })
        .catch(() => undefined)
        .finally(() => {
          if (!ctrl.signal.aborted) setLmLoading(false);
        });
    }, 800);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
      setLmLoading(false);
    };
  }, [geoSig]);

  const autoSteps = useMemo(() => {
    if (phase !== "edit") return [];
    try {
      return buildSteps(
        doc.segments,
        doc.landmarks.filter((l) => !l.hidden),
      );
    } catch {
      return [];
    }
  }, [phase, doc.segments, doc.landmarks]);

  const steps = useMemo(() => mergeSteps(doc.steps, autoSteps), [doc.steps, autoSteps]);

  const lastLabel = waypoints(doc.segments).at(-1)?.label ?? "";
  const fullDoc = useMemo<RouteDoc>(
    () => ({ ...doc, title: doc.title.trim() || defaultTitle(lastLabel), steps }),
    [doc, steps, lastLabel],
  );

  const draftDoc = useMemo<RouteDoc>(
    () => ({ ...fullDoc, steps: storedSteps(doc.steps, autoSteps, steps) }),
    [fullDoc, doc.steps, autoSteps, steps],
  );

  useEffect(() => {
    if (phase === "edit" && saveArmed && draftDoc.segments.length) saveDraft(draftDoc);
  }, [draftDoc, phase, saveArmed]);

  useEffect(() => {
    const flush = () => flushDraft();
    const onVis = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(id);
  }, [notice]);

  const doUndo = useCallback(() => {
    setHist(undo);
    setTool({ kind: "none" });
    setSelectedVia(null);
  }, []);
  const doRedo = useCallback(() => {
    setHist(redo);
    setTool({ kind: "none" });
    setSelectedVia(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        doRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doUndo, doRedo]);

  function nameIt(lng: number, lat: number) {
    const k = `${lng},${lat}`;
    setNaming((n) => [...n, k]);
    reverseName(lng, lat)
      .catch(() => "")
      .then((label) => {
        setNaming((n) => n.filter((x) => x !== k));
        if (!label) return;
        setPending((p) => ({
          start: p.start && p.start.lng === lng && p.start.lat === lat && !p.start.label ? { ...p.start, label } : p.start,
          end: p.end && p.end.lng === lng && p.end.lat === lat && !p.end.label ? { ...p.end, label } : p.end,
        }));
        setHist((h) => {
          const next = nameWaypoint(h.present, lng, lat, label);
          if (next === h.present) return h;
          return {
            ...h,
            present: next,
            past: h.past.map((d) => nameWaypoint(d, lng, lat, label)),
            future: h.future.map((d) => nameWaypoint(d, lng, lat, label)),
          };
        });
      });
  }

  function createRoute(start: Pending["start"], end: Pending["end"]) {
    if (!start || !end) return;
    const seg = newSegment(start, end, "walk");
    const d: RouteDoc = { ...emptyDoc(), title: defaultTitle(end.label), segments: [seg] };
    setHist(createHistory(d));
    setRouted({});
    setErrors({});
    setPhase("edit");
    setSaveArmed(true);
    setStage("route");
    fitAfterRoute.current = true;
    setFitTick((n) => n + 1);
  }

  function placePoint(which: "start" | "end", p: { lng: number; lat: number; label: string }) {
    const w = { lng: p.lng, lat: p.lat, label: p.label };
    const next = { ...pending, [which]: w };
    setPending(next);
    if (!p.label) nameIt(p.lng, p.lat);
    if (next.start && next.end) createRoute(next.start, next.end);
    else setFitTick((n) => n + 1);
  }

  function pickOption(segId: string, optId: string) {
    const opt = legOptions[segId]?.list.find((o) => o.id === optId);
    if (!opt) return;
    commit((d) => ({
      ...d,
      segments: d.segments.map((sg) => (sg.id === segId && !sg.drawn ? withRoute(sg, opt.geometry) : sg)),
    }));
  }

  const handlers = {
    onTap(p: LngLat, hit: RouteHit | null) {
      if (phase === "setup") {
        placePoint(pending.start ? "end" : "start", { lng: p[0], lat: p[1], label: "" });
        return;
      }
      if (phase !== "edit") return;
      if (tool.kind === "via") {
        const seg = doc.segments.find((x) => x.id === tool.segId);
        if (seg && seg.vias.length >= MAX_VIAS) {
          setNotice(t.tooManyVias);
          setTool({ kind: "none" });
          return;
        }
        commit((d) => ({ ...d, segments: addVia(d.segments, tool.segId, p) }));
        setTool({ kind: "none" });
      } else if (tool.kind === "split") {
        const idx = doc.segments.findIndex((s) => s.id === tool.segId);
        if (!hit || hit.px > 44 || idx < 0) {
          setNotice(t.splitMissed);
          return;
        }
        const seg = doc.segments[idx];
        const res = splitSegment(doc.segments, idx, hit.pos, "matatu", uid());
        if (!res) {
          setNotice(t.splitMissed);
          return;
        }
        commit((d) => ({ ...d, segments: res.segments }));
        const first = res.segments[idx];
        if (seg.drawn || routed[seg.id] === segKey(seg)) setRouted((m) => ({ ...m, [first.id]: segKey(first) }));
        setFocusStop(res.stopIndex);
        setStage("route");
        setTool({ kind: "none" });
      } else if (tool.kind === "landmark") {
        setDraftLandmark(p);
        setStage("directions");
        setTool({ kind: "none" });
      } else {
        setSelectedVia(null);
      }
    },
    onMoveWaypoint(i: number, p: LngLat) {
      commit((d) => ({ ...d, segments: moveWaypoint(d.segments, i, p) }));
    },
    onMovePending(which: "start" | "end", p: LngLat) {
      setPending((s) => (s[which] ? { ...s, [which]: { ...s[which]!, lng: p[0], lat: p[1] } } : s));
    },
    onMoveVia(segId: string, i: number, p: LngLat) {
      commit((d) => ({ ...d, segments: moveVia(d.segments, segId, i, p) }));
    },
    onSelectVia(v: ViaRef) {
      setSelectedVia(v);
    },
    onLineDrag(index: number, p: LngLat) {
      const seg = doc.segments[index];
      if (!seg || seg.drawn) return;
      if (seg.vias.length >= MAX_VIAS) {
        setNotice(t.tooManyVias);
        return;
      }
      commit((d) => ({ ...d, segments: addVia(d.segments, seg.id, p) }));
    },
    onPickOption(segId: string, optId: string) {
      pickOption(segId, optId);
    },
    onDrawn(segId: string, line: LngLat[]) {
      commit((d) => ({ ...d, segments: setDrawn(d.segments, segId, line) }));
      setRouted((m) => omit(m, segId));
      setTool({ kind: "none" });
    },
  };

  const actions = {
    continueDraft() {
      if (!init.draft) return;
      setHist(createHistory(init.draft));
      setRouted(routedKeys(init.draft));
      setStage("route");
      setSaveArmed(true);
      setPhase("edit");
      setFitTick((n) => n + 1);
    },
    startNew() {
      clearDraft();
      setSaveArmed(true);
      setHist(createHistory(emptyDoc()));
      setPending({ start: null, end: null });
      setPhase("setup");
      setStage("where");
    },
    placePoint,
    resetPending(which: "start" | "end") {
      setPending((p) => ({ ...p, [which]: null }));
    },
    setPendingLabel(which: "start" | "end", label: string) {
      setPending((p) => (p[which] ? { ...p, [which]: { ...p[which]!, label } } : p));
    },
    setMode(id: string, mode: Mode) {
      commit((d) => ({ ...d, segments: setMode(d.segments, id, mode) }));
    },
    setTool(next: Tool) {
      setSelectedVia(null);
      setTool(next);
    },
    revert(id: string) {
      commit((d) => ({ ...d, segments: revertDrawn(d.segments, id) }));
      setRouted((m) => omit(m, id));
    },
    retry(id: string) {
      setErrors((m) => omit(m, id));
    },
    setLabel(index: number, label: string) {
      commit((d) => {
        const wps = waypoints(d.segments);
        const last = wps.length - 1;
        let title = d.title;
        if (index === last && (!d.title.trim() || d.title === defaultTitle(wps[last]?.label))) title = defaultTitle(label);
        return { ...d, title, segments: setWaypointLabel(d.segments, index, label) };
      }, `label:${index}`);
    },
    removeStop(index: number) {
      commit((d) => ({ ...d, segments: mergeAtStop(d.segments, index) }));
      setFocusStop(null);
    },
    removeSelectedVia() {
      if (!selectedVia) return;
      const v = selectedVia;
      commit((d) => ({ ...d, segments: removeVia(d.segments, v.segId, v.i) }));
      setSelectedVia(null);
    },
    clearSelection: () => setSelectedVia(null),
    updateLandmark(id: string, patch: Partial<Landmark>, key?: string) {
      commit((d) => ({ ...d, landmarks: d.landmarks.map((l) => (l.id === id ? { ...l, ...patch } : l)) }), key);
    },
    deleteLandmark(id: string) {
      commit((d) => ({ ...d, landmarks: d.landmarks.filter((l) => l.id !== id) }));
    },
    addLandmark(label: string, note: string) {
      if (!draftLandmark) return;
      const lm: Landmark = {
        id: `h-${uid()}`,
        lng: draftLandmark[0],
        lat: draftLandmark[1],
        label,
        kind: "host",
        source: "host",
        ...(note ? { note } : {}),
      };
      commit((d) => ({ ...d, landmarks: [...d.landmarks, lm] }));
      setDraftLandmark(null);
    },
    cancelDraftLandmark: () => setDraftLandmark(null),
    editStep(id: string, text: string) {
      const display = steps.map((s) => (s.id === id ? { ...s, text, edited: true } : s));
      commit((d) => ({ ...d, steps: storedSteps(d.steps, autoSteps, display) }), `step:${id}`);
    },
    resetStep(id: string) {
      const auto = autoSteps.find((s) => s.id === id);
      const display = steps.map((s) => (s.id === id ? (auto ?? { ...s, edited: false }) : s));
      commit((d) => ({ ...d, steps: storedSteps(d.steps, autoSteps, display) }));
    },
    setTitle(title: string) {
      commit((d) => ({ ...d, title }), "title");
    },
    setArrival(note: string) {
      commit((d) => ({ ...d, arrival: { note } }), "arrival");
    },
    setWalker(walker: Walker) {
      commit((d) => ({ ...d, walker }));
    },
    pickOption,
    undo: doUndo,
    redo: doRedo,
    setStage,
    setAsking,
    clearTransient,
  };

  return {
    phase,
    doc,
    fullDoc,
    steps,
    pending,
    naming,
    tool,
    stage,
    asking,
    selectedVia,
    draftLandmark,
    focusStop,
    notice,
    lmLoading,
    fitTick,
    status,
    legOptions,
    canUndo: canUndo(hist),
    canRedo: canRedo(hist),
    hasDraft: !!init.draft,
    handlers,
    actions,
  };
}
