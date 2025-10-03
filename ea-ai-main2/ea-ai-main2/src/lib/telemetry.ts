// Minimal frontend auth telemetry helper
// Posts small JSON payloads to the Convex HTTP telemetry endpoint

type Extra = Record<string, any> | undefined;

export function sendAuthTelemetry(phase: string, extra?: Extra) {
  try {
    const explicit = import.meta.env.VITE_CONVEX_HTTP_ORIGIN as string | undefined;
    let base: string | undefined = undefined;
    if (explicit) {
      try {
        const u = new URL(explicit);
        const host = u.hostname.endsWith('.convex.cloud')
          ? u.hostname.replace('.convex.cloud', '.convex.site')
          : u.hostname;
        base = `${u.protocol}//${host}${u.port ? `:${u.port}` : ''}`;
      } catch {
        base = explicit.replace('.convex.cloud', '.convex.site');
      }
    } else {
      const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
      if (convexUrl) {
        try {
          const u = new URL(convexUrl);
          const host = u.hostname.endsWith('.convex.cloud')
            ? u.hostname.replace('.convex.cloud', '.convex.site')
            : u.hostname;
          base = `${u.protocol}//${host}`;
        } catch {
          // leave undefined
        }
      }
    }
    if (!base) return;
    const body = {
      phase,
      href: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      timestamp: Date.now(),
      ...extra,
    };
    fetch(`${base.replace(/\/$/, '')}/telemetry/oauth-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // No credentials; Authorization not needed here, CORS handled server-side
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
