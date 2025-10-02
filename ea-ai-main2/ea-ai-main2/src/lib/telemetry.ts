// Minimal frontend auth telemetry helper
// Posts small JSON payloads to the Convex HTTP telemetry endpoint

type Extra = Record<string, any> | undefined;

export function sendAuthTelemetry(phase: string, extra?: Extra) {
  try {
    const base = import.meta.env.VITE_CONVEX_URL as string | undefined;
    if (!base) return;
    const body = {
      phase,
      href: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      timestamp: Date.now(),
      ...extra,
    };
    fetch(`${base}/telemetry/oauth-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    // no-op
  }
}

export function authDebugLog(...args: any[]) {
  try {
    if (import.meta.env.VITE_AUTH_DEBUG === 'true') {
      // eslint-disable-next-line no-console
      console.log('[AUTH DEBUG]', ...args);
    }
  } catch {
    // no-op
  }
}
