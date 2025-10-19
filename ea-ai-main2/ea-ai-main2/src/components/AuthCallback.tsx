"use client";

import { useClerk, useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";

export default function AuthCallback() {
  const clerk = useClerk();
  const { handleRedirectCallback } = clerk;
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);

  const GCAL_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.settings.readonly',
  ];

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
              // Verify Google external account now includes required Calendar scopes
              try {
                let tries = 0;
                while (tries < 3) {
                  try { const anyClerk: any = clerk as any; if (anyClerk?.load) { await anyClerk.load(); } } catch {}
                  const updatedUser: any = (clerk as any).user;
                  const extAcc: any = updatedUser?.externalAccounts?.find?.((a: any) => a?.provider === 'google' || a?.provider === 'oauth_google');
                  const approved = String(extAcc?.approvedScopes || '');
                  const have = approved.split(/\s+/).filter(Boolean);
                  const ok = GCAL_SCOPES.every(s => have.includes(s));
                  if (ok) {
                    window.opener?.postMessage({ type: 'GCAL_CONNECTED' }, '*');
                    break;
                  }
                  tries++;
                  await new Promise(r => setTimeout(r, 400));
                }
                if (tries >= 3) {
                  // Still missing scopes
                  try {
                    const updatedUser: any = (clerk as any).user;
                    const extAcc: any = updatedUser?.externalAccounts?.find?.((a: any) => a?.provider === 'google' || a?.provider === 'oauth_google');
                    const approved = String(extAcc?.approvedScopes || '');
                    const have = approved.split(/\s+/).filter(Boolean);
                    window.opener?.postMessage({ type: 'GCAL_MISSING_SCOPES', have }, '*');
                  } catch {
                    window.opener?.postMessage({ type: 'GCAL_MISSING_SCOPES' }, '*');
                  }
                }
              } catch {
                try { window.opener?.postMessage({ type: 'GCAL_MISSING_SCOPES' }, '*'); } catch {}
              }
              window.close();
            } else {
              // Check onboarding status before redirecting
              const onboardingComplete = user?.publicMetadata?.onboardingComplete;
              if (!onboardingComplete) {
                window.location.replace('/onboarding');
              } else {
                window.location.replace(to || '/');
              }
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
            // Fallback: notify parent to re-check connection
            try { window.opener?.postMessage({ type: 'GCAL_MISSING_SCOPES' }, '*'); } catch {}
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
