"use client";

// Tailark login-3 block markup with Clerk wiring (Google + Email code only)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignIn, useSignUp } from "@clerk/clerk-react";
import { useState } from "react";
import { sendAuthTelemetry, authDebugLog } from "@/lib/telemetry";

type Mode = "idle" | "verifying";
type Flow = "signIn" | "signUp" | null;

export function Auth() {
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [flow, setFlow] = useState<Flow>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    if (!isSignInLoaded) return;
    try {
      setError(null);
      sendAuthTelemetry("oauth_signin_start");
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err: any) {
      authDebugLog("Google OAuth Error", err);
      sendAuthTelemetry("oauth_signin_error", { error: String(err?.message || err) });
      setError("Failed to sign in with Google. Please try again.");
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError(null);
    try {
      // Try sign-in passwordless
      if (!isSignInLoaded) return;
      sendAuthTelemetry("email_code_prepare_signin", { email });
      const si = await signIn.create({ identifier: email });
      const emailFactor: any = (si as any)?.supportedFirstFactors?.find((f: any) => f.strategy === "email_code");
      if (emailFactor) {
        await (signIn as any).prepareFirstFactor({ strategy: "email_code", emailAddressId: emailFactor.emailAddressId });
        setFlow("signIn");
        setMode("verifying");
        return;
      }
      // If no email_code factor, fall back to sign up
      if (!isSignUpLoaded) return;
      sendAuthTelemetry("email_code_prepare_signup", { email });
      await signUp.create({ emailAddress: email });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setFlow("signUp");
      setMode("verifying");
    } catch (err: any) {
      // Fallback: try sign up flow directly
      try {
        if (!isSignUpLoaded) throw err;
        sendAuthTelemetry("email_code_prepare_signup_fallback", { email });
        await signUp.create({ emailAddress: email });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setFlow("signUp");
        setMode("verifying");
      } catch (err2: any) {
        authDebugLog("Email code prepare error", err2);
        setError(err2?.errors?.[0]?.message || "Failed to send code. Please try again.");
      }
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setError(null);
    try {
      if (flow === "signIn") {
        const res: any = await (signIn as any).attemptFirstFactor({ strategy: "email_code", code });
        if (res?.status === "complete") {
          try { if (res?.createdSessionId && typeof (signIn as any).setActive === "function") await (signIn as any).setActive({ session: res.createdSessionId }); } catch {}
          sendAuthTelemetry("email_code_signin_complete", { email });
          window.location.replace("/");
          return;
        }
        setError("Verification incomplete. Please try again.");
        return;
      }
      if (flow === "signUp") {
        if (!isSignUpLoaded || !signUp) return;
        const res = await signUp.attemptEmailAddressVerification({ code });
        if ((res as any)?.status === "complete") {
          try { if ((res as any).createdSessionId && typeof (signUp as any).setActive === "function") await (signUp as any).setActive({ session: (res as any).createdSessionId }); } catch {}
          sendAuthTelemetry("email_code_signup_complete", { email });
          window.location.replace("/");
          return;
        }
        setError("Verification incomplete. Please try again.");
        return;
      }
      setError("Unexpected state. Please restart the flow.");
    } catch (err: any) {
      authDebugLog("Email code verify error", err);
      setError(err?.errors?.[0]?.message || "Invalid code. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="flex min-h-screen px-4 py-16 md:py-32">
        <form className="max-w-md m-auto h-fit w-full" onSubmit={mode === "idle" ? handleSendCode : handleVerifyCode}>
        <div className="p-6">
          <div>
            <a href="/" aria-label="go home" className="flex items-center gap-2 w-fit">
              <div className="w-8 h-8 flex items-center justify-center">
                <img src="/oldowan-logo.png" alt="Oldowan" className="w-8 h-8 object-contain" />
              </div>
              <span className="font-semibold text-lg">Oldowan</span>
            </a>
            <h1 className="mb-1 mt-4 text-xl font-semibold">Sign In</h1>
            <p>Welcome back! Sign in to continue</p>
          </div>

          <div className="mt-6">
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={!isSignInLoaded}>
              {/* Google icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="0.98em" height="1em" viewBox="0 0 256 262">
                <path fill="#4285f4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"></path>
                <path fill="#34a853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"></path>
                <path fill="#fbbc05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"></path>
                <path fill="#eb4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"></path>
              </svg>
              <span>Sign in with Google</span>
            </Button>
          </div>

          <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <hr className="border-dashed" />
            <span className="text-muted-foreground text-xs">Or continue With</span>
            <hr className="border-dashed" />
          </div>

          <div className="space-y-6">
            {mode === "idle" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="block text-sm">Email</Label>
                  <Input type="email" required name="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button className="w-full" type="submit" disabled={!isSignInLoaded && !isSignUpLoaded}>Continue</Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="code" className="block text-sm">Enter code</Label>
                  <Input type="text" required name="code" id="code" value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
                <Button className="w-full" type="submit">Verify</Button>
                <Button type="button" variant="link" className="px-0" onClick={() => { setMode("idle"); setFlow(null); setCode(""); }}>Use a different email</Button>
              </>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <p className="text-accent-foreground text-center text-sm">
          Don't have an account ?
          <a href="#" className="text-primary hover:text-primary/80 transition-colors ml-1">Create account</a>
        </p>

        <div className="mt-8 pt-6 border-t border-border flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
          <a href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-primary transition-colors">Terms of Service</a>
          <a href="mailto:AtheA.hab@gmail.com" className="hover:text-primary transition-colors">Support</a>
        </div>
      </form>
      </section>
    </div>
  );
}
