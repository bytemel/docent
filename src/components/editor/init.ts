import type { RouteDoc } from "@/lib/types";
import { t } from "@/strings/editor";
import { readFromParams } from "@/app/here/params";
import { defaultTitle, emptyDoc, isRouteDoc, newSegment } from "./ops";
import type { Pending } from "./types";

export type Phase = "resume" | "setup" | "edit";

export interface InitState {
  doc: RouteDoc;
  phase: Phase;
  draft: RouteDoc | null;
  saveArmed: boolean;
  badLink: boolean;
  pending: Pending;
  ask: boolean;
}

export function normalise(d: RouteDoc): RouteDoc {
  return {
    ...emptyDoc(),
    ...d,
    title: typeof d.title === "string" ? d.title : "",
    arrival: { note: typeof d.arrival?.note === "string" ? d.arrival.note : "" },
    walker: d.walker === "man" || d.walker === "woman" ? d.walker : "neutral",
  };
}

export function initialState(
  search: string,
  loadDraft: () => unknown,
  decode: (encoded: string) => unknown,
): InitState {
  const ask = new URLSearchParams(search).get("ask") === "1";
  return { ...baseState(search, loadDraft, decode), ask };
}

function baseState(
  search: string,
  loadDraft: () => unknown,
  decode: (encoded: string) => unknown,
): Omit<InitState, "ask"> {
  const sp = new URLSearchParams(search);
  const d = sp.get("d");
  const none: Pending = { start: null, end: null };
  let raw: unknown = null;
  try {
    raw = loadDraft();
  } catch {
    raw = null;
  }
  const draft = isRouteDoc(raw) ? normalise(raw) : null;
  let badLink = false;
  if (d) {
    let doc: unknown = null;
    try {
      doc = decode(d);
    } catch {
      doc = null;
    }
    if (isRouteDoc(doc)) return { doc: normalise(doc), phase: "edit", draft, saveArmed: !draft, badLink, pending: none };
    badLink = true;
  }
  if (sp.has("from")) {
    const from = readFromParams(search, t.theirLocation);
    if (from?.to) {
      const seg = newSegment(from.from, from.to, "walk");
      const doc: RouteDoc = { ...emptyDoc(), title: defaultTitle(from.to.label), segments: [seg] };
      return { doc, phase: "edit", draft, saveArmed: !draft, badLink, pending: none };
    }
    if (from) return { doc: emptyDoc(), phase: "setup", draft, saveArmed: true, badLink, pending: { start: from.from, end: null } };
    badLink = true;
  }
  if (draft) return { doc: emptyDoc(), phase: "resume", draft, saveArmed: true, badLink, pending: none };
  return { doc: emptyDoc(), phase: "setup", draft: null, saveArmed: true, badLink, pending: none };
}

const LINK_KEYS = ["d", "from", "fl", "to", "ask"] as const;
const DOC_KEYS = ["d", "from", "fl", "to"] as const;

export function searchFromParams(sp: Record<string, string | string[] | undefined>): string {
  const out = new URLSearchParams();
  for (const k of LINK_KEYS) {
    const v = sp[k];
    const first = Array.isArray(v) ? v[0] : v;
    if (typeof first === "string" && first.length <= 16000) out.set(k, first);
  }
  const q = out.toString();
  return q ? `?${q}` : "";
}

export function editorKey(search: string): string {
  const sp = new URLSearchParams(search);
  return DOC_KEYS.map((k) => sp.get(k) ?? "").join("|");
}

export function wantsAsk(search: string): boolean {
  return new URLSearchParams(search).get("ask") === "1";
}

export function hasLinkParams(search: string): boolean {
  const sp = new URLSearchParams(search);
  return LINK_KEYS.some((k) => sp.has(k));
}
