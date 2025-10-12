"use client";

import { useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSessions } from "../../context/sessions";
import { cn } from "@/lib/utils";

interface ChatGreetingProps {
  className?: string;
}

export function ChatGreeting({ className = "" }: ChatGreetingProps) {
  const { user, isLoaded } = useUser();
  const { currentSessionId } = useSessions();
  const genGreeting = useAction(api.chatSessions.generateGreetingForUser);

  const hour = useMemo(() => new Date().getHours(), []);

  const lastName = useMemo(() => {
    if (!isLoaded || !user) return "there";
    const ln = (user.lastName || "").trim();
    if (ln) return ln;
    const full = (user.fullName || "").trim();
    if (full) {
      const parts = full.split(/\s+/);
      const last = parts[parts.length - 1] || "";
      if (last) return last;
    }
    const uname = (user.username || "").trim();
    if (uname) return uname;
    const email = user?.primaryEmailAddress?.emailAddress || "";
    if (email) return (email.split("@")[0] || "").trim() || "there";
    return "there";
  }, [isLoaded, user]);

  const fallbackGreeting = useMemo(() => {
    if (hour < 12) return `Good morning, ${lastName}.`;
    if (hour < 18) return `Good afternoon, ${lastName}.`;
    return `Good evening, ${lastName}.`;
  }, [hour, lastName]);

  const [greeting, setGreeting] = useState<string>(fallbackGreeting);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (!currentSessionId) {
          setGreeting(fallbackGreeting);
          return;
        }
        const g = await genGreeting({ sessionId: currentSessionId as any, lastName, localHour: hour });
        if (!cancelled) setGreeting((g as string) || fallbackGreeting);
      } catch {
        if (!cancelled) setGreeting(fallbackGreeting);
      }
    }
    run();
    return () => { cancelled = true };
  }, [currentSessionId, genGreeting, lastName, hour, fallbackGreeting]);

  return (
    <div className={cn("w-full text-center", className)}>
      <h1 
        className="t-display tracking-wide mb-10 flex items-center justify-center"
        style={{ 
          fontFamily: "var(--greeting-font-family)",
          color: "var(--text-100)",
          fontWeight: 500
        }}
      >
        {greeting}
      </h1>
    </div>
  );
}