export const APP_ANDROID_URL: string | null = null;
export const CONTACT_EMAIL = "hello@docent.app";
export const PRIVACY_UPDATED = "27 September 2026";

export const INDEXED_PATHS = ["/", "/how-it-works", "/app", "/privacy"] as const;
export const NOINDEX_PATHS = ["/routes", "/go", "/new", "/r", "/here", "/live"] as const;
export const DISALLOWED_PATHS = ["/api/"] as const;

export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
}

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}
