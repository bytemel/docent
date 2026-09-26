"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  PlayIcon,
  ShareNetworkIcon,
} from "@phosphor-icons/react";
import { shareUrl } from "@/lib/share";
import { NAIROBI } from "@/lib/map";
import { t } from "@/strings/editor";
import EditorMap, { type MapApi } from "./EditorMap";
import Sheet from "./Sheet";
import SetupPanel from "./SetupPanel";
import RouteTab from "./RouteTab";
import LandmarksTab from "./LandmarksTab";
import StepsTab from "./StepsTab";
import DetailsTab from "./DetailsTab";
import ShareSheet from "./ShareSheet";
import AskSheet from "./AskSheet";
import PreviewDialog from "./PreviewDialog";
import { defaultTitle, waypoints } from "./ops";
import { useEditor } from "./useEditor";
import type { Padding, Tab } from "./types";

const TABS: Tab[] = ["route", "landmarks", "steps", "details"];

export default function Editor() {
  const e = useEditor();
  const { actions: a } = e;
  const mapApi = useRef<MapApi | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const [preview, setPreview] = useState(false);
  const [share, setShare] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const fitTick = e.fitTick;

  const padding = useCallback((): Padding => {
    if (window.matchMedia("(min-width: 1024px)").matches) return { top: 90, left: 436, right: 48, bottom: 48 };
    const h = sheetRef.current?.getBoundingClientRect().height ?? window.innerHeight * 0.42;
    return { top: 80, left: 48, right: 48, bottom: h + 24 };
  }, []);

  const [mapReady, setMapReady] = useState(false);
  const onReady = useCallback((api: MapApi | null) => {
    mapApi.current = api;
    setMapReady(!!api);
  }, []);

  useEffect(() => {
    if (fitTick > 0 && mapReady) mapApi.current?.fit(padding());
  }, [fitTick, mapReady, padding]);

  const getCenter = useCallback((): [number, number] => mapApi.current?.getCenter() ?? NAIROBI, []);

  const closeShare = useCallback(() => setShare(null), []);
  const openAsk = useCallback(() => setAsking(true), []);
  const closeAsk = useCallback(() => setAsking(false), []);
  const flyTo = useCallback((p: [number, number]) => mapApi.current?.flyTo(p, padding()), [padding]);
  const closePreview = useCallback(() => setPreview(false), []);
  const editing = e.phase === "edit";
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

  const actionsRow = (
    <>
      <button type="button" className="btn" onClick={() => setPreview(true)} disabled={!editing}>
        <PlayIcon size={18} aria-hidden />
        {t.preview}
      </button>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!editing}
        onClick={() => setShare(shareUrl(e.fullDoc, window.location.origin))}
      >
        <ShareNetworkIcon size={18} aria-hidden />
        {t.share}
      </button>
    </>
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      <EditorMap
        segments={e.doc.segments}
        pending={e.pending}
        landmarks={e.doc.landmarks}
        draftLandmark={e.draftLandmark}
        tool={e.tool}
        selectedVia={e.selectedVia}
        handlers={{ ...e.handlers, onStyleState: setMapLoading }}
        onReady={onReady}
      />
      {mapLoading ? (
        <div role="progressbar" aria-label={t.mapLoading} className="absolute inset-x-0 top-0 z-40 h-1 bg-accent-soft">
          <div className="h-full w-full animate-pulse bg-accent" />
        </div>
      ) : null}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Link href="/" className="btn btn-icon pointer-events-auto shrink-0 shadow-float" aria-label={t.back} title={t.back}>
          <ArrowLeftIcon size={20} aria-hidden />
        </Link>
        {editing ? (
          <div className="pointer-events-auto min-w-0 flex-1 lg:max-w-[344px]">
            <label htmlFor="top-title" className="sr-only">
              {t.titleLabel}
            </label>
            <input
              id="top-title"
              className="field truncate font-semibold shadow-float"
              value={e.doc.title}
              placeholder={defaultTitle(lastLabel)}
              onChange={(ev) => a.setTitle(ev.target.value)}
            />
          </div>
        ) : (
          <p className="panel pointer-events-auto flex min-h-11 min-w-0 items-center truncate px-4 font-semibold">
            {t.pageTitle}
          </p>
        )}
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
                <ArrowCounterClockwiseIcon size={20} aria-hidden />
              </button>
              <button
                type="button"
                className="btn btn-icon pointer-events-auto shadow-float"
                onClick={a.redo}
                disabled={!e.canRedo}
                aria-label={t.redo}
                title={t.redo}
              >
                <ArrowClockwiseIcon size={20} aria-hidden />
              </button>
              <div className="pointer-events-auto hidden gap-2 sm:flex [&>.btn]:shadow-float">{actionsRow}</div>
            </>
          ) : null}
        </div>
      </header>

      {hint || e.notice || e.selectedVia ? (
        <div className="pointer-events-none absolute inset-x-2 top-[64px] z-30 flex justify-center lg:left-[424px]">
          <div role="status" className="panel pointer-events-auto flex max-w-md flex-wrap items-center gap-2 px-3 py-2 text-sm">
            {e.selectedVia && !hint ? (
              <>
                <span className="font-medium text-ink">{t.viaSelected}</span>
                <button type="button" className="btn text-danger" onClick={a.removeSelectedVia}>
                  {t.removeVia}
                </button>
                <button type="button" className="btn btn-ghost" onClick={a.clearSelection}>
                  {t.done}
                </button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 font-medium text-ink">{hint ?? e.notice}</span>
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
        header={
          editing ? (
            <div className="flex shrink-0 flex-col gap-2 border-b border-line px-4 pb-2 pt-2">
              <div className="flex gap-2 sm:hidden">{actionsRow}</div>
              <div role="tablist" aria-label={t.pageTitle} className="-mx-1 flex gap-0.5 overflow-x-auto px-1 sm:gap-1">
                {TABS.map((id) => (
                  <button
                    key={id}
                    id={`tab-${id}`}
                    role="tab"
                    type="button"
                    aria-selected={e.tab === id}
                    aria-controls={`panel-${id}`}
                    className="min-h-11 shrink-0 rounded-full px-2.5 text-sm font-semibold sm:px-3.5 text-ink-2 aria-selected:bg-ink aria-selected:text-bg"
                    onClick={() => a.setTab(id)}
                  >
                    {t.tabs[id]}
                  </button>
                ))}
              </div>
            </div>
          ) : null
        }
      >
        {e.phase === "resume" ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">{t.resumeTitle}</h2>
            <p className="text-sm text-ink-2">{t.resumeBody}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={a.continueDraft}>
                {t.resumeContinue}
              </button>
              <button type="button" className="btn" onClick={a.startNew}>
                {t.resumeNew}
              </button>
            </div>
          </section>
        ) : e.phase === "setup" ? (
          <SetupPanel
            pending={e.pending}
            naming={e.naming}
            getCenter={getCenter}
            onPick={a.placePoint}
            onPreview={flyTo}
            onReset={a.resetPending}
            onLabel={a.setPendingLabel}
            onAsk={openAsk}
          />
        ) : (
          <div role="tabpanel" id={`panel-${e.tab}`} aria-labelledby={`tab-${e.tab}`}>
            {e.tab === "route" ? (
              <RouteTab
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
                onAsk={openAsk}
              />
            ) : e.tab === "landmarks" ? (
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
            ) : e.tab === "steps" ? (
              <StepsTab steps={e.steps} onEdit={a.editStep} onReset={a.resetStep} />
            ) : (
              <DetailsTab
                title={e.doc.title}
                titlePlaceholder={defaultTitle(lastLabel)}
                arrival={e.doc.arrival.note}
                walker={e.doc.walker}
                onTitle={a.setTitle}
                onArrival={a.setArrival}
                onWalker={a.setWalker}
              />
            )}
          </div>
        )}
      </Sheet>

      {asking ? (
        <AskSheet destination={waypoints(e.doc.segments).at(-1) ?? e.pending.end} onClose={closeAsk} />
      ) : null}
      {share ? <ShareSheet url={share} title={e.fullDoc.title} onClose={closeShare} /> : null}
      {preview ? (
        <PreviewDialog doc={e.fullDoc} onClose={closePreview} />
      ) : null}
    </div>
  );
}
