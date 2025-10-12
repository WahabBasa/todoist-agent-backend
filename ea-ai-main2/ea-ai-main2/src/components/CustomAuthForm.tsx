"use client";

import { useSignIn, useSignUp } from "@clerk/clerk-react";
import { useState } from "react";
import { sendAuthTelemetry, authDebugLog } from "@/lib/telemetry";

export function CustomAuthForm() {
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignInForm, setShowSignInForm] = useState(false);
  const [showSignUpForm, setShowSignUpForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingEmailVerification, setPendingEmailVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const handleGoogleSignIn = async () => {
    if (!isSignInLoaded) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      authDebugLog('Starting Google OAuth redirect');
      sendAuthTelemetry('oauth_signin_start');
      
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
      
      // Note: This line won't execute due to redirect
      authDebugLog('OAuth redirect initiated');
      
    } catch (err: any) {
      authDebugLog('Google OAuth Error', err);
      sendAuthTelemetry('oauth_signin_error', { error: String(err?.message || err) });
      
      // Show user-friendly error
      if (err.errors && err.errors.length > 0) {
        const errorMsg = err.errors[0].longMessage || err.errors[0].message;
        setError(`OAuth failed: ${errorMsg}`);
      } else {
        setError("Failed to sign in with Google. This might be due to calendar permissions. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignInLoaded || !email || !password) return;
    
    try {
      setIsLoading(true);
      setError(null);
      sendAuthTelemetry('email_signin_start', { email });
      
      const result = await signIn.create({
        identifier: email,
        password: password,
      });

      if (result.status === "complete") {
        // Sign in successful, the page will reload automatically
        authDebugLog("Email sign in complete", { email });
        try {
          if ((result as any).createdSessionId && typeof (signIn as any).setActive === 'function') {
            await (signIn as any).setActive({ session: (result as any).createdSessionId });
          }
        } catch {}
        sendAuthTelemetry('email_signin_complete', { email });
      } else if (result.status === "needs_first_factor") {
        // Handle first factor verification (like email verification)
        authDebugLog("Email sign in needs first factor", { email });
        sendAuthTelemetry('email_signin_pending_factor', { email, status: result.status });
        setError("Please check your email for verification.");
      } else if (result.status === "needs_second_factor") {
        // Handle two-factor authentication
        authDebugLog("Email sign in needs second factor", { email });
        sendAuthTelemetry('email_signin_pending_factor', { email, status: result.status });
        setError("Two-factor authentication required.");
      }
    } catch (err: any) {
      authDebugLog("Email sign-in error", err);
      sendAuthTelemetry('email_signin_error', { email, error: err?.errors?.[0]?.message || String(err?.message || err) });
      if (err.errors && err.errors.length > 0) {
        setError(err.errors[0].message || "Failed to sign in. Please check your credentials.");
      } else {
        setError("Failed to sign in. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignUpLoaded || !email || !password) return;
    
    try {
      setIsLoading(true);
      setError(null);
      sendAuthTelemetry('email_signup_start', { email });
      
      const result = await signUp.create({
        emailAddress: email,
        password: password,
      });

      // Send verification code via email
      try {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setPendingEmailVerification(true);
        sendAuthTelemetry('email_signup_verify_sent', { email });
      } catch (prepErr: any) {
        authDebugLog('prepareEmailAddressVerification error', prepErr);
        setError('Failed to send verification code. Please try again.');
        sendAuthTelemetry('email_signup_verify_error', { email, error: String(prepErr?.message || prepErr) });
      }
    } catch (err: any) {
      authDebugLog("Sign-up error", err);
      sendAuthTelemetry('email_signup_error', { email, error: err?.errors?.[0]?.message || String(err?.message || err) });
      if (err.errors && err.errors.length > 0) {
        setError(err.errors[0].message || "Failed to sign up. Please try again.");
      } else {
        setError("Failed to sign up. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignUpLoaded || !verificationCode) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await signUp.attemptEmailAddressVerification({ code: verificationCode });
      if (res.status === 'complete') {
        sendAuthTelemetry('email_signup_verify_success', { email });
        try {
          if ((res as any).createdSessionId && typeof (signUp as any).setActive === 'function') {
            await (signUp as any).setActive({ session: (res as any).createdSessionId });
          }
        } catch {}
        sendAuthTelemetry('email_signup_complete', { email });
        authDebugLog('Email sign up complete', { email });
        // Reset local UI state
        setPendingEmailVerification(false);
        setVerificationCode("");
      } else {
        // Unexpected status; ask user to retry
        authDebugLog('Email verification status', res.status);
        setError('Verification incomplete. Please try again.');
        sendAuthTelemetry('email_signup_verify_status', { email, status: res.status });
      }
    } catch (err: any) {
      authDebugLog('Email verification error', err);
      setError(err?.errors?.[0]?.message || 'Invalid verification code. Please try again.');
      sendAuthTelemetry('email_signup_verify_error', { email, error: err?.errors?.[0]?.message || String(err?.message || err) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 max-w-sm space-y-4">
      {/* Google Sign In Button */}
      <button
        onClick={() => {
          handleGoogleSignIn().catch(console.error);
        }}
        disabled={isLoading || !isSignInLoaded}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-background border border-input rounded-lg hover:bg-muted/50 transition-colors text-sm font-medium text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        Continue with Google
      </button>
      
      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">OR</span>
        </div>
      </div>
      
      {/* Email Verification Step */}
      {pendingEmailVerification ? (
        <form onSubmit={(e) => {
          e.preventDefault();
          handleVerifyEmailCode(e).catch(console.error);
        }} className="space-y-4">
          <div>
            <label htmlFor="verification-code" className="block text-sm font-medium text-foreground mb-1">
              Enter verification code
            </label>
            <input
              id="verification-code"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              placeholder="6-digit code"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !isSignUpLoaded || !verificationCode}
            className="w-full bg-foreground text-background hover:bg-foreground/90 px-3 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin mx-auto" />
            ) : (
              "Verify"
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingEmailVerification(false);
              setVerificationCode("");
              setShowSignInForm(false);
              setShowSignUpForm(false);
              setEmail("");
              setPassword("");
              setError(null);
            }}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </form>
      ) : showSignInForm ? (
        <form onSubmit={(e) => {
          e.preventDefault();
          handleEmailSignIn(e).catch(console.error);
        }} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              placeholder="Enter your email"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              placeholder="Enter your password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !isSignInLoaded || !email || !password}
            className="w-full bg-foreground text-background hover:bg-foreground/90 px-3 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin mx-auto" />
            ) : (
              "Sign In"
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSignInForm(false);
              setShowSignUpForm(false);
              setEmail("");
              setPassword("");
              setError(null);
            }}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </form>
      ) : showSignUpForm ? (
        <form onSubmit={(e) => {
          e.preventDefault();
          handleEmailSignUp(e).catch(console.error);
        }} className="space-y-4">
          <div>
            <label htmlFor="signup-email" className="block text-sm font-medium text-foreground mb-1">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              placeholder="Enter your email"
              required
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="block text-sm font-medium text-foreground mb-1">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              placeholder="Create a password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !isSignUpLoaded || !email || !password}
            className="w-full bg-foreground text-background hover:bg-foreground/90 px-3 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin mx-auto" />
            ) : (
              "Sign Up"
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSignInForm(false);
              setShowSignUpForm(false);
              setEmail("");
              setPassword("");
              setError(null);
            }}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          {/* Sign In Button */}
          <button
            onClick={() => setShowSignInForm(true)}
            disabled={isLoading || !isSignInLoaded}
            className="w-full bg-foreground text-background hover:bg-foreground/90 px-3 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sign In
          </button>
          
          {/* Sign Up Link */}
          <div className="text-center">
            <button
              onClick={() => setShowSignUpForm(true)}
              disabled={isLoading || !isSignUpLoaded}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline focus:outline-none focus:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              New to TaskAI? Sign up
            </button>
          </div>
        </>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      
      {/* Privacy Policy */}
      <div className="text-center pt-2">
        <p className="text-xs text-muted-foreground">
          By continuing, you acknowledge TaskAI's{" "}
          <button type="button" className="underline hover:text-foreground">
            Privacy Policy
          </button>
          .
        </p>
      </div>
    </div>
  );
}
