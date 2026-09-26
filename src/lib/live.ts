export interface LiveFix {
  lng: number;
  lat: number;
  acc: number;
  heading: number | null;
  speed: number | null;
  t: number;
}

export type LiveStatus = "connecting" | "live" | "stopped" | "offline" | "unavailable";

export interface LiveShare {
  id: string;
  watchUrl: string;
  send(fix: LiveFix): void;
  stop(): Promise<void>;
}

export interface StartLiveShareOptions {
  encodedDoc: string;
  origin: string;
  name?: string;
  onStatus?: (status: LiveStatus) => void;
}

export function isLiveConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function startLiveShare(opts: StartLiveShareOptions): Promise<LiveShare> {
  void opts;
  throw new Error("Live sharing is not configured");
}

export async function watchLive(
  id: string,
  onFix: (fix: LiveFix) => void,
  onStatus: (status: LiveStatus) => void,
): Promise<() => void> {
  void id;
  void onFix;
  onStatus("unavailable");
  return () => {};
}
