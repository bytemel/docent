"use client";

import { useState } from "react";
import { EyeIcon, EyeSlashIcon, MapPinPlusIcon, TrashIcon } from "@phosphor-icons/react";
import type { Landmark, LngLat } from "@/lib/types";
import { t } from "@/strings/editor";
import type { Tool } from "./types";

interface Props {
  landmarks: Landmark[];
  loading: boolean;
  tool: Tool;
  draft: LngLat | null;
  onTool(tool: Tool): void;
  onUpdate(id: string, patch: Partial<Landmark>, coalesce?: string): void;
  onDelete(id: string): void;
  onAdd(label: string, note: string): void;
  onCancelDraft(): void;
}

export default function LandmarksTab(p: Props) {
  const map = p.landmarks.filter((l) => l.source === "map");
  const host = p.landmarks.filter((l) => l.source === "host");
  const adding = p.tool.kind === "landmark";
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">{t.landmarksIntro}</p>
      {p.draft ? (
        <DraftForm onAdd={p.onAdd} onCancel={p.onCancelDraft} />
      ) : (
        <button
          type="button"
          className="btn self-start aria-pressed:border-ink aria-pressed:bg-accent-soft"
          aria-pressed={adding}
          onClick={() => p.onTool(adding ? { kind: "none" } : { kind: "landmark" })}
        >
          <MapPinPlusIcon size={18} weight="bold" aria-hidden />
          {t.addLandmark}
        </button>
      )}
      {host.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-bold text-ink">{t.yourLandmarks}</h3>
          {host.map((l) => (
            <div key={l.id} className="flex flex-col gap-2 rounded-[18px] border border-line p-3">
              <label htmlFor={`lm-${l.id}`} className="text-sm font-semibold text-ink-2">
                {t.landmarkLabel}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`lm-${l.id}`}
                  className="field min-w-0 flex-1"
                  value={l.label}
                  onChange={(e) => p.onUpdate(l.id, { label: e.target.value }, `lm:${l.id}:label`)}
                />
                <button
                  type="button"
                  className="btn btn-icon btn-ghost shrink-0"
                  aria-label={t.deleteLandmark}
                  title={t.deleteLandmark}
                  onClick={() => p.onDelete(l.id)}
                >
                  <TrashIcon size={18} aria-hidden />
                </button>
              </div>
              <label htmlFor={`lmn-${l.id}`} className="text-sm font-semibold text-ink-2">
                {t.landmarkNote}
              </label>
              <input
                id={`lmn-${l.id}`}
                className="field"
                value={l.note ?? ""}
                onChange={(e) => p.onUpdate(l.id, { note: e.target.value }, `lm:${l.id}:note`)}
              />
            </div>
          ))}
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-bold text-ink">{t.mapLandmarks}</h3>
        {map.length === 0 ? (
          <p className="text-sm text-ink-3" aria-live="polite">
            {p.loading ? t.landmarksLoading : t.landmarksEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {map.map((l) => (
              <li key={l.id} className="flex flex-col gap-1.5">
                <label htmlFor={`lm-${l.id}`} className="text-sm font-semibold text-ink-2">
                  {t.kinds[l.kind] ?? t.kinds.other}
                  <span className="sr-only">, {t.landmarkLabel}</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`lm-${l.id}`}
                    className={`field min-w-0 flex-1 ${l.hidden ? "text-ink-3 line-through" : ""}`}
                    value={l.label}
                    onChange={(e) => p.onUpdate(l.id, { label: e.target.value }, `lm:${l.id}:label`)}
                  />
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost shrink-0"
                    aria-pressed={!l.hidden}
                    aria-label={l.hidden ? t.show : t.hide}
                    title={l.hidden ? t.show : t.hide}
                    onClick={() => p.onUpdate(l.id, { hidden: !l.hidden })}
                  >
                    {l.hidden ? <EyeSlashIcon size={20} aria-hidden /> : <EyeIcon size={20} aria-hidden />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DraftForm({ onAdd, onCancel }: { onAdd(label: string, note: string): void; onCancel(): void }) {
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);
  return (
    <form
      className="flex flex-col gap-2 rounded-[18px] border border-line p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim()) {
          setError(true);
          return;
        }
        onAdd(label.trim(), note.trim());
      }}
    >
      <label htmlFor="lm-draft" className="text-sm font-semibold text-ink-2">
        {t.landmarkLabel}
      </label>
      <input
        id="lm-draft"
        className="field"
        value={label}
        autoFocus
        aria-required="true"
        aria-invalid={error}
        aria-describedby={error ? "lm-draft-err" : undefined}
        onChange={(e) => {
          setLabel(e.target.value);
          setError(false);
        }}
      />
      {error ? (
        <p id="lm-draft-err" className="text-sm text-danger">
          {t.landmarkRequired}
        </p>
      ) : null}
      <label htmlFor="lm-draft-note" className="text-sm font-semibold text-ink-2">
        {t.landmarkNote}
      </label>
      <input
        id="lm-draft-note"
        className="field"
        value={note}
        placeholder={t.landmarkNotePlaceholder}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" className="btn btn-primary">
          {t.saveLandmark}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
