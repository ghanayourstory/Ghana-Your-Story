// The client never decides outcomes. It sends intents to a backend: either
// the real game server over HTTP, or (offline demo) the same engine running
// in a Web Worker in this browser.

export interface Backend {
  mode: "server" | "offline";
  request<T = unknown>(method: string, path: string, body?: unknown, idemKey?: string): Promise<{ status: number; json: T }>;
}

const TOKEN_KEY = "sika.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: session-only */
  }
}

export function newIdemKey(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function httpBackend(): Backend {
  return {
    mode: "server",
    async request(method, path, body, idemKey) {
      const headers: Record<string, string> = { "content-type": "application/json" };
      const token = getToken();
      if (token) headers.authorization = `Bearer ${token}`;
      if (idemKey) headers["idempotency-key"] = idemKey;
      // Retry network failures with the SAME idempotency key so nothing applies twice.
      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
          return { status: res.status, json: await res.json() };
        } catch (err) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
      throw lastErr;
    },
  };
}

export function offlineBackend(): Backend {
  const engine = import("./offline-engine.ts");
  return {
    mode: "offline",
    async request(method, path, body, idemKey) {
      const { offlineRequest } = await engine;
      return offlineRequest({ method, path, body: body ?? null, token: getToken(), idemKey: idemKey ?? null }) as Promise<{ status: number; json: never }>;
    },
  };
}

/** Prefer the real server; fall back to the offline engine when there isn't one. */
export async function pickBackend(): Promise<Backend> {
  if (import.meta.env.VITE_OFFLINE === "1") return offlineBackend();
  try {
    const res = await fetch("/api/health", { signal: AbortSignal.timeout(2500) });
    if (res.ok && (await res.json()).ok) return httpBackend();
  } catch {
    /* no server */
  }
  return offlineBackend();
}
