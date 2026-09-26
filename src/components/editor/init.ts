import type { RouteDoc } from "@/lib/types";
import { emptyDoc, isRouteDoc } from "./ops";

export type Phase = "resume" | "setup" | "edit";

export interface InitState {
  doc: RouteDoc;
  phase: Phase;
  draft: RouteDoc | null;
  saveArmed: boolean;
  badLink: boolean;
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
  const d = new URLSearchParams(search).get("d");
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
    if (isRouteDoc(doc)) return { doc: normalise(doc), phase: "edit", draft, saveArmed: !draft, badLink };
    badLink = true;
  }
  if (draft) return { doc: emptyDoc(), phase: "resume", draft, saveArmed: true, badLink };
  return { doc: emptyDoc(), phase: "setup", draft: null, saveArmed: true, badLink };
}
