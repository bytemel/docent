"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PaperPlaneTiltIcon,
  SpeakerHighIcon,
} from "@phosphor-icons/react";
import VoiceToggle from "@/components/ui/VoiceToggle";
import { shareUrl } from "@/lib/share";
import { NAIROBI } from "@/lib/map";
import { t } from "@/strings/editor";
import EditorMap, { type MapApi } from "./EditorMap";
import Sheet from "./Sheet";
import Rail from "./Rail";
import { AskCard, WhereEdit, WhereSetup } from "./WhereStage";
import RouteStage, { Totals } from "./RouteStage";
import LandmarksTab from "./LandmarksTab";
import StepPlates, { hearAll } from "./StepPlates";
import SendStage, { SendActions } from "./SendStage";
import AskSheet from "./AskSheet";
import PreviewDialog from "./PreviewDialog";
import { defaultTitle, optionStats, waypoints } from "./ops";
import type { AltLine } from "./mapController";
import { MODES } from "@/lib/modes";
import { formatDistance } from "@/lib/geo";
import { useEditor } from "./useEditor";
import { STAGES, type Padding, type Stage } from "./types";
import type { RouteDoc } from "@/lib/types";

const SNAP: Record<Stage, number> = { where: 0.62, route: 0.42, directions: 0.72, send: 0.84 };

export default function Editor() {
  const e = useEditor();
  const { actions: a } = e;
  const mapApi = useRef<MapApi | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const [preview, setPreview] = useState<RouteDoc | null>(null);
  const [snapshot, setSnapshot] = useState<{ key: string; url: string | null } | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const fitTick = e.fitTick;

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sheet = sheetRef.current;
    const root = rootRef.current;
    if (!sheet || !root) return;
    const ro = new ResizeObserver(() => {
      const h = sheet.getBoundingClientRect().height;
      root.style.setProperty("--dc-sheet", `${h}px`);
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      mapApi.current?.setObscured({ top: 64, right: 0, left: desktop ? 424 : 0, bottom: desktop ? 0 : h });
    });
    ro.observe(sheet);
    return () => ro.disconnect();
  }, []);

  const padding = useCallback((): Padding => {
    if (window.matchMedia("(min-width: 1024px)").matches) return { top: 90, left: 472, right: 60, bottom: 60 };
    const h = sheetRef.current?.getBoundingClientRect().height ?? window.innerHeight * 0.42;
    return { top: 80, left: 48, right: 48, bottom: h + 24 };
  }, []);

  const [mapReady, setMapReady] = useState(false);
  const onReady = useCallback((api: MapApi | null) => {
    mapApi.current = api;
    setMapReady(!!api);
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => mapApi.current?.setBase({ top: 0, right: 0, bottom: 0, left: mq.matches ? 424 : 0 });
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mapReady]);

  useEffect(() => {
    if (fitTick > 0 && mapReady) mapApi.current?.fit(padding());
  }, [fitTick, mapReady, padding]);

  const getCenter = useCallback((): [number, number] => mapApi.current?.getCenter() ?? NAIROBI, []);

  const openAsk = useCallback(() => a.setAsking(true), [a]);
  const closeAsk = useCallback(() => a.setAsking(false), [a]);
  const flyTo = useCallback((p: [number, number]) => mapApi.current?.flyTo(p, padding()), [padding]);
  const closePreview = useCallback(() => setPreview(null), []);
  const editing = e.phase === "edit";
  const stage = e.stage;
  const tool = e.tool;
  const hint =
    tool.kind === "via"
      ? t.hintAddVia
      : tool.kind === "split"
        ? t.hintSplit
        : tool.kind === "draw"
          ? t.hintDraw
          : tool.kind === "landmark"
            ? t.hintLandmark
            : null;
  const lastLabel = waypoints(e.doc.segments).at(-1)?.label;
  const busy = e.doc.segments.some((s) => e.status(s) === "loading");
  const legOptions = e.legOptions;
  const alts = useMemo<AltLine[]>(() => {
    if (stage !== "route" || !editing) return [];
    const out: AltLine[] = [];
    for (const seg of e.doc.segments) {
      const o = legOptions[seg.id];
      if (!o) continue;
      const stats = optionStats(seg, o.list, o.selectedId);
      for (const opt of o.list) {
        if (opt.id === o.selectedId) continue;
        const dd = stats[opt.id].distanceM - seg.distanceM;
        const dt = Math.round((stats[opt.id].durationS - seg.durationS) / 60);
        const tag =
          dd < -5
            ? opt.labels.includes("shortest")
              ? t.tagShortest
              : t.tagShorter(formatDistance(-dd))
            : dt < 0
              ? t.tagFaster(formatDistance(dd), -dt)
              : t.tagSlower(formatDistance(Math.max(0, dd)), dt);
        out.push({
          segId: seg.id,
          optId: opt.id,
          color: MODES[seg.mode].color,
          geometry: opt.geometry,
          tag,
        });
      }
    }
    return out;
  }, [stage, editing, e.doc.segments, legOptions]);
  const snapKey = e.doc.segments.map((s) => `${s.id}:${s.mode}:${s.distanceM}:${s.geometry.length}`).join("|");
  const url = useMemo(
    () => (editing && stage === "send" ? shareUrl(e.fullDoc, window.location.origin) : ""),
    [editing, stage, e.fullDoc],
  );

  const takeSnapshot = useCallback(() => {
    const api = mapApi.current;
    if (!api) return;
    const key = snapKey;
    setSnapshot({ key, url: null });
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    api
      .snapshot({ top: 72, left: desktop ? 424 : 28, right: 28, bottom: 28 })
      .then((shot) => setSnapshot((cur) => (cur?.key === key ? { key, url: shot } : cur)));
  }, [snapKey]);

  const altKey = alts.map((x) => `${x.segId}:${x.optId}`).join("|");
  const altsRef = useRef(alts);
  useEffect(() => {
    altsRef.current = alts;
  }, [alts]);
  useEffect(() => {
    if (!altKey || !mapReady) return;
    const id = setTimeout(() => mapApi.current?.fit(padding(), altsRef.current.flatMap((x) => x.geometry)), 280);
    return () => clearTimeout(id);
  }, [altKey, mapReady, padding]);

  function go(next: Stage) {
    a.setTool({ kind: "none" });
    a.setStage(next);
    if (next === "send") {
      if (snapshot?.key !== snapKey && !busy) setTimeout(takeSnapshot, 50);
    } else if (next !== "where" || editing) {
      setTimeout(() => mapApi.current?.fit(padding(), next === "route" ? altsRef.current.flatMap((x) => x.geometry) : []), 260);
    }
  }

  const reachable = (s: Stage) => s === "where" || editing;
  const nextOf = (s: Stage) => STAGES[STAGES.indexOf(s) + 1];
  const copy = e.phase === "resume" ? { title: t.resumeTitle, lead: t.resumeBody } : t.stages[stage];

  const header = (
    <div className="shrink-0 px-4 pb-3 pt-2 lg:px-5 lg:pt-4">
      {e.phase !== "resume" ? <Rail stage={stage} reachable={reachable} onGo={go} /> : null}
      <div className="mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink min-[400px]:text-[22px]">
            {copy.title}
          </h2>
          <p className="mt-1 text-[14px] leading-snug text-ink-2 [@media(max-height:700px)]:hidden">{copy.lead}</p>
        </div>
        {stage === "directions" && editing && e.steps.length ? (
          <button type="button" className="btn shrink-0 px-3" onClick={() => hearAll(e.steps)} aria-label={t.hearAll}>
            <SpeakerHighIcon size={18} weight="bold" aria-hidden />
            <span className="max-[359px]:sr-only">{t.hearAll}</span>
          </button>
        ) : null}
      </div>
      {stage === "route" && editing ? (
        <div className="mt-2.5">
          <Totals segments={e.doc.segments} busy={busy} />
        </div>
      ) : null}
    </div>
  );

  const footer =
    e.phase === "resume" || !editing ? null : stage === "send" ? (
      <SendActions url={url} title={e.fullDoc.title} />
    ) : (
      <button
        type="button"
        className="btn btn-primary btn-lg w-full"
        disabled={!editing}
        onClick={() => go(nextOf(stage))}
      >
        {t.next[stage as "where" | "route" | "directions"]}
        {stage === "directions" ? (
          <PaperPlaneTiltIcon size={20} weight="bold" aria-hidden />
        ) : (
          <ArrowRightIcon size={20} weight="bold" aria-hidden />
        )}
      </button>
    );

  let body;
  if (e.phase === "resume") {
    body = (
      <div className="flex flex-col gap-2 pt-1">
        <button type="button" className="btn btn-primary btn-lg w-full" onClick={a.continueDraft}>
          {t.resumeContinue}
        </button>
        <button type="button" className="btn btn-lg w-full" onClick={a.startNew}>
          {t.resumeNew}
        </button>
      </div>
    );
  } else if (stage === "where" && !editing) {
    body = (
      <WhereSetup
        pending={e.pending}
        naming={e.naming}
        getCenter={getCenter}
        onPick={a.placePoint}
        onPreview={flyTo}
        onReset={a.resetPending}
        onLabel={a.setPendingLabel}
        onAsk={openAsk}
      />
    );
  } else if (stage === "where") {
    body = (
      <div className="flex flex-col gap-4">
        <WhereEdit segments={e.doc.segments} focusStop={e.focusStop} onLabel={a.setLabel} onRemoveStop={a.removeStop} />
        <AskCard onAsk={openAsk} />
      </div>
    );
  } else if (stage === "route") {
    body = (
      <RouteStage
        segments={e.doc.segments}
        status={e.status}
        tool={e.tool}
        focusStop={e.focusStop}
        onMode={a.setMode}
        onTool={a.setTool}
        onRevert={a.revert}
        onRetry={a.retry}
        onLabel={a.setLabel}
        onRemoveStop={a.removeStop}
        options={legOptions}
        onPickOption={a.pickOption}
      />
    );
  } else if (stage === "directions") {
    body = (
      <div className="flex flex-col gap-6">
        <StepPlates steps={e.steps} segments={e.doc.segments} onEdit={a.editStep} onReset={a.resetStep} />
        <section className="flex flex-col gap-1.5" aria-labelledby="arrival-h">
          <h3 id="arrival-h" className="text-[17px] font-bold text-ink">
            {t.arrivalHeading}
          </h3>
          <label htmlFor="details-arrival" className="text-sm font-semibold text-ink-2">
            {t.arrivalLabel}
          </label>
          <textarea
            id="details-arrival"
            className="field resize-none py-2.5 leading-snug"
            rows={2}
            value={e.doc.arrival.note}
            placeholder={t.arrivalPlaceholder}
            onChange={(ev) => a.setArrival(ev.target.value)}
          />
        </section>
        <section className="flex flex-col gap-3" aria-labelledby="landmarks-h">
          <h3 id="landmarks-h" className="text-[17px] font-bold text-ink">
            {t.landmarksHeading}
          </h3>
          <LandmarksTab
            landmarks={e.doc.landmarks}
            loading={e.lmLoading}
            tool={e.tool}
            draft={e.draftLandmark}
            onTool={a.setTool}
            onUpdate={a.updateLandmark}
            onDelete={a.deleteLandmark}
            onAdd={a.addLandmark}
            onCancelDraft={a.cancelDraftLandmark}
          />
        </section>
      </div>
    );
  } else {
    body = (
      <SendStage
        doc={e.fullDoc}
        url={url}
        title={e.doc.title}
        titlePlaceholder={defaultTitle(lastLabel)}
        snapshot={snapshot?.key === snapKey ? snapshot.url : null}
        snapshotting={snapshot?.key === snapKey && snapshot.url === null}
        onTitle={a.setTitle}
        onWalker={a.setWalker}
        onPreview={() => setPreview(e.fullDoc)}
        onAsk={openAsk}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 overflow-hidden bg-bg max-lg:[&_.maplibregl-ctrl-bottom-right]:bottom-[var(--dc-sheet,0px)]!"
    >
      <EditorMap
        segments={e.doc.segments}
        pending={e.pending}
        landmarks={e.doc.landmarks}
        draftLandmark={e.draftLandmark}
        tool={e.tool}
        selectedVia={e.selectedVia}
        alts={alts}
        handlers={{ ...e.handlers, onStyleState: setMapLoading }}
        onReady={onReady}
      />
      {mapLoading ? (
        <div role="progressbar" aria-label={t.mapLoading} className="absolute inset-x-0 top-0 z-40 h-1 bg-accent-soft">
          <div className="h-full w-full animate-pulse bg-accent" />
        </div>
      ) : null}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:p-3 lg:pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/" className="btn btn-icon pointer-events-auto shrink-0 shadow-float" aria-label={t.back} title={t.back}>
          <ArrowLeftIcon size={20} weight="bold" aria-hidden />
        </Link>
        <p className="panel pointer-events-auto hidden min-h-11 items-center px-4 text-[15px] font-extrabold tracking-[-0.01em] sm:flex">
          {t.pageTitle}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                className="btn btn-icon pointer-events-auto shadow-float"
                onClick={a.undo}
                disabled={!e.canUndo}
                aria-label={t.undo}
                title={t.undo}
              >
                <ArrowCounterClockwiseIcon size={20} weight="bold" aria-hidden />
              </button>
              <button
                type="button"
                className="btn btn-icon pointer-events-auto shadow-float"
                onClick={a.redo}
                disabled={!e.canRedo}
                aria-label={t.redo}
                title={t.redo}
              >
                <ArrowClockwiseIcon size={20} weight="bold" aria-hidden />
              </button>
            </>
          ) : null}
          <VoiceToggle className="pointer-events-auto shadow-float" />
        </div>
      </header>

      {hint || e.notice || e.selectedVia ? (
        <div className="pointer-events-none absolute inset-x-2 top-[64px] z-30 flex justify-center lg:left-[424px]">
          <div role="status" className="panel pointer-events-auto flex max-w-md flex-wrap items-center gap-2 px-3 py-2 text-sm">
            {e.selectedVia && !hint ? (
              <>
                <span className="font-semibold text-ink">{t.viaSelected}</span>
                <button type="button" className="btn text-danger" onClick={a.removeSelectedVia}>
                  {t.removeVia}
                </button>
                <button type="button" className="btn btn-ghost" onClick={a.clearSelection}>
                  {t.done}
                </button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 font-semibold text-ink">{hint ?? e.notice}</span>
                {hint ? (
                  <button type="button" className="btn btn-ghost" onClick={() => a.setTool({ kind: "none" })}>
                    {t.cancel}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      <Sheet
        sheetRef={sheetRef}
        lowered={tool.kind !== "none"}
        label={t.pageTitle}
        snap={e.phase === "resume" ? 0.42 : SNAP[stage]}
        header={header}
        footer={footer}
        scrollKey={`${e.phase}:${stage}`}
      >
        {body}
      </Sheet>

      {e.asking ? (
        <AskSheet destination={waypoints(e.doc.segments).at(-1) ?? e.pending.end} onClose={closeAsk} />
      ) : null}
      {preview ? <PreviewDialog doc={preview} onClose={closePreview} /> : null}
    </div>
  );
}
