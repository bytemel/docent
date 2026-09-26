"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Landmark, LngLat, Mode, RouteDoc, Segment, Walker } from "@/lib/types";
import { MODES } from "@/lib/modes";
import { uid } from "@/lib/geo";
import { buildSteps } from "@/lib/steps";
import { findLandmarks } from "@/lib/landmarks";
import { decodeDoc } from "@/lib/share";
import { routeLeg } from "@/lib/routing";
import { clearDraft, flushDraft, loadDraft, saveDraft } from "@/lib/draft";
import { amendHistory, canRedo, canUndo, createHistory, pushHistory, redo, undo, type History } from "@/lib/history";
import { t } from "@/strings/editor";
import { reverseName } from "./api";
import {
  addVia,
  defaultTitle,
  emptyDoc,
  isRouteDoc,
  legPoints,
  mergeAtStop,
  mergeLandmarks,
  mergeSteps,
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
  waypoints,
} from "./ops";
import type { LegStatus } from "./RouteTab";
import type { Pending, RouteHit, Tab, Tool, ViaRef } from "./types";

type Phase = "resume" | "setup" | "edit";

function normalise(d: RouteDoc): RouteDoc {
  return {
    ...emptyDoc(),
    ...d,
    title: typeof d.title === "string" ? d.title : "",
    arrival: { note: d.arrival?.note ?? "" },
    walker: d.walker ?? "neutral",
  };
}

function routedKeys(doc: RouteDoc): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of doc.segments) if (!s.drawn && s.geometry.length > 2) out[s.id] = segKey(s);
  return out;
}

function initial(): { doc: RouteDoc; phase: Phase; draft: RouteDoc | null } {
  if (typeof window === "undefined") return { doc: emptyDoc(), phase: "setup", draft: null };
  const d = new URLSearchParams(window.location.search).get("d");
  if (d) {
    const doc = decodeDoc(d);
    if (isRouteDoc(doc)) return { doc: normalise(doc), phase: "edit", draft: null };
  }
  const draft = loadDraft();
  if (draft && isRouteDoc(draft)) return { doc: emptyDoc(), phase: "resume", draft: normalise(draft) };
  return { doc: emptyDoc(), phase: "setup", draft: null };
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
  const [pending, setPending] = useState<Pending>({ start: null, end: null });
  const [naming, setNaming] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>({ kind: "none" });
  const [tab, setTab] = useState<Tab>("route");
  const [selectedVia, setSelectedVia] = useState<ViaRef | null>(null);
  const [draftLandmark, setDraftLandmark] = useState<LngLat | null>(null);
  const [focusStop, setFocusStop] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lmLoading, setLmLoading] = useState(false);
  const [fitTick, setFitTick] = useState(init.phase === "edit" ? 1 : 0);
  const inflight = useRef(new Map<string, { key: string; ctrl: AbortController }>());
  const fitAfterRoute = useRef(init.phase === "edit");
  const segsRef = useRef<Segment[]>(init.doc.segments);
  const doc = hist.present;

  const commit = useCallback((fn: (d: RouteDoc) => RouteDoc, key?: string) => {
    setHist((h) => pushHistory(h, fn(h.present), { key }));
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
    if (!new URLSearchParams(window.location.search).has("d")) return;
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      // Keeping the long link in the address bar is harmless.
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

  useEffect(() => {
    if (phase === "edit" && fullDoc.segments.length) saveDraft(fullDoc);
  }, [fullDoc, phase]);

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
    setTab("route");
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

  const handlers = {
    onTap(p: LngLat, hit: RouteHit | null) {
      if (phase === "setup") {
        placePoint(pending.start ? "end" : "start", { lng: p[0], lat: p[1], label: "" });
        return;
      }
      if (phase !== "edit") return;
      if (tool.kind === "via") {
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
        setTab("route");
        setTool({ kind: "none" });
      } else if (tool.kind === "landmark") {
        setDraftLandmark(p);
        setTab("landmarks");
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
      commit((d) => ({ ...d, segments: addVia(d.segments, seg.id, p) }));
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
      setPhase("edit");
      setFitTick((n) => n + 1);
    },
    startNew() {
      clearDraft();
      setHist(createHistory(emptyDoc()));
      setPending({ start: null, end: null });
      setPhase("setup");
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
      commit((d) => ({ ...d, steps: steps.map((s) => (s.id === id ? { ...s, text, edited: true } : s)) }), `step:${id}`);
    },
    resetStep(id: string) {
      const auto = autoSteps.find((s) => s.id === id);
      commit((d) => ({
        ...d,
        steps: steps.map((s) => (s.id === id ? (auto ?? { ...s, edited: false }) : s)),
      }));
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
    undo: doUndo,
    redo: doRedo,
    setTab,
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
    tab,
    selectedVia,
    draftLandmark,
    focusStop,
    notice,
    lmLoading,
    fitTick,
    status,
    canUndo: canUndo(hist),
    canRedo: canRedo(hist),
    hasDraft: !!init.draft,
    handlers,
    actions,
  };
}
