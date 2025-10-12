"use client";

import { useClerk } from "@clerk/clerk-react";
import { useEffect, useState } from "react";

export default function AuthCallback() {
  const { handleRedirectCallback } = useClerk();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let navigated = false;
    const isPopup = typeof window !== 'undefined' && !!window.opener && !window.opener.closed;
    (async () => {
      try {
        await handleRedirectCallback(
          {
            signInForceRedirectUrl: '/',
            signUpForceRedirectUrl: '/',
          },
          async (to: string) => {
            navigated = true;
            if (isPopup) {
              try {
                window.opener?.postMessage({ type: 'GCAL_CONNECTED' }, '*');
              } catch {}
              window.close();
            } else {
              window.location.replace(to || '/');
            }
          }
        );
      } catch (e: any) {
        setError(e?.message || 'Failed to complete sign in');
      } finally {
        try {
          if (!isPopup && typeof window !== 'undefined') {
            const hasClerkParams = window.location.search.includes('__clerk') || window.location.hash.includes('__clerk');
            if (hasClerkParams) {
              window.history.replaceState(null, '', window.location.pathname);
            }
          }
        } catch {}
        if (!navigated) {
          if (isPopup) {
            try { window.opener?.postMessage({ type: 'GCAL_CONNECTED' }, '*'); } catch {}
            if (typeof window !== 'undefined') window.close();
          } else if (typeof window !== 'undefined') {
            window.location.replace('/');
          }
        }
      }
    })();
  }, [handleRedirectCallback]);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto animate-pulse">
          <img src="/oldowan-logo.png" alt="Loading" className="w-full h-full object-contain" />
        </div>
        <p className="text-muted-foreground">Completing sign in...</p>
        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}
      </div>
    </div>
  );
}
