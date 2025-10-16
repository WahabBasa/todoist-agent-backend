"use client";

import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { dark } from "@clerk/themes";
import { ThemeProvider } from "./theme-provider";
import { useTheme } from "next-themes";

function resolveConvexUrl(): string | null {
  try {
    const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
    if (url && /^https?:\/\//.test(url)) return url;

    const httpOrigin = import.meta.env.VITE_CONVEX_HTTP_ORIGIN as string | undefined;
    if (httpOrigin) {
      try {
        const u = new URL(httpOrigin);
        const host = u.hostname.endsWith('.convex.site')
          ? u.hostname.replace('.convex.site', '.convex.cloud')
          : u.hostname;
        return `${u.protocol}//${host}`;
      } catch {
        // best-effort string replacement fallback
        if (/^https?:\/\//.test(httpOrigin)) {
          return httpOrigin.replace('.convex.site', '.convex.cloud');
        }
      }
    }
  } catch {}
  return null;
}

// Import your Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Add your Clerk Publishable Key to the .env file');
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ConvexProvidersWithTheme>{children}</ConvexProvidersWithTheme>
    </ThemeProvider>
  );
}

function ConvexProvidersWithTheme({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const convexUrl = resolveConvexUrl();
  const convexClient = (() => {
    if (!convexUrl) return null;
    try {
      return new ConvexReactClient(convexUrl);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Config] Invalid VITE_CONVEX_URL, expected absolute URL', e);
      return null;
    }
  })();

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      afterSignInUrl="/"
      afterSignUpUrl="/"
      appearance={{
        baseTheme: resolvedTheme === "dark" ? dark : undefined,
      }}
    >
      {convexClient ? (
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          {children}
        </ConvexProviderWithClerk>
      ) : (
        <div style={{ padding: 16, color: 'var(--soft-off-white)' }}>
          Configuration error: VITE_CONVEX_URL (or VITE_CONVEX_HTTP_ORIGIN) is missing or invalid. Set an absolute URL to your Convex deployment (e.g., https://your-deployment.convex.cloud) and rebuild.
        </div>
      )}
    </ClerkProvider>
  );
}
